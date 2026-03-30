import {
  editorSuggestionsSchema,
  generateEditorSuggestions,
  generateGhostWriterDraft,
  generateThoughtPartnerOutput,
  thoughtPartnerOutputSchema
} from "@/lib/ai";
import { db } from "@/lib/db";
import { logEvent, nowIso } from "@/lib/logger";
import { getScenarioById } from "@/lib/scenarios";
import { getSessionSnapshot } from "@/lib/sessionManager";
import type { RoleCondition } from "@/lib/types";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  action: z.enum([
    "ghost_writer_generate",
    "editor_suggest",
    "thought_partner_questions",
    "thought_partner_summary"
  ]),
  bullets: z.array(z.string()).optional(),
  message: z.string().optional(),
  reflections: z
    .array(z.object({ question: z.string().min(1), response: z.string().min(1) }))
    .optional()
});

function expectedCondition(action: z.infer<typeof bodySchema>["action"]): RoleCondition {
  if (action === "ghost_writer_generate") {
    return "ghost_writer";
  }
  if (action === "editor_suggest") {
    return "editor";
  }
  return "thought_partner";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse> {
  try {
    const { sessionId } = await context.params;
    const body = bodySchema.parse(await request.json());

    const snapshot = getSessionSnapshot(sessionId);
    const trial = snapshot.currentTrial;
    const scenario = getScenarioById(trial.scenario_id);

    const condition = expectedCondition(body.action);
    if (trial.condition !== condition) {
      throw new Error(`Action ${body.action} does not match active condition ${trial.condition}.`);
    }

    const createdAt = nowIso();

    if (body.action === "ghost_writer_generate") {
      const bullets = body.bullets?.map((item) => item.trim()).filter(Boolean) ?? [];
      if (bullets.length < 3 || bullets.length > 5) {
        throw new Error("Ghost-writer requires 3-5 bullets before generation.");
      }

      const ai = await generateGhostWriterDraft({ scenario, bullets });
      const result = db
        .prepare(
          `
          INSERT INTO ai_calls (session_id, trial_index, condition, stage, request_json, response_json, validated_json, is_valid, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
          `
        )
        .run(
          sessionId,
          trial.trial_index,
          trial.condition,
          "ai_generation",
          JSON.stringify({ systemPrompt: ai.systemPrompt, userPrompt: ai.userPrompt, bullets }),
          JSON.stringify({ rawText: ai.rawText }),
          JSON.stringify({ draft: ai.rawText }),
          createdAt
        );

      logEvent({
        sessionId,
        trialIndex: trial.trial_index,
        eventType: "ai_call",
        payload: { action: body.action, aiCallId: result.lastInsertRowid }
      });

      return NextResponse.json({ draft: ai.rawText, aiCallId: result.lastInsertRowid });
    }

    if (body.action === "editor_suggest") {
      const message = (body.message ?? "").trim();
      if (!message) {
        throw new Error("Editor requires a full human-written message.");
      }

      const ai = await generateEditorSuggestions({ scenario, message });
      const parsed = editorSuggestionsSchema.parse(ai.parsed);

      const result = db
        .prepare(
          `
          INSERT INTO ai_calls (session_id, trial_index, condition, stage, request_json, response_json, validated_json, is_valid, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
          `
        )
        .run(
          sessionId,
          trial.trial_index,
          trial.condition,
          "ai_revision",
          JSON.stringify({ systemPrompt: ai.systemPrompt, userPrompt: ai.userPrompt }),
          JSON.stringify({ rawText: ai.rawText }),
          JSON.stringify(parsed),
          createdAt
        );

      const aiCallId = Number(result.lastInsertRowid);
      const insertSuggestion = db.prepare(
        `
        INSERT INTO editor_suggestions (ai_call_id, segment_original, suggested_change, category, reason_text, action_status)
        VALUES (?, ?, ?, ?, ?, 'pending')
        `
      );

      const responseSuggestions: Array<{
        id: number;
        originalSegment: string;
        suggestedChange: string;
        category: "tone" | "specificity" | "empathy" | "closing_next_step";
        reasonText: string;
      }> = [];

      for (const suggestion of parsed.suggestions) {
        const insertResult = insertSuggestion.run(
          aiCallId,
          suggestion.originalSegment,
          suggestion.suggestedChange,
          suggestion.category,
          suggestion.reasonText
        );
        responseSuggestions.push({
          id: Number(insertResult.lastInsertRowid),
          originalSegment: suggestion.originalSegment,
          suggestedChange: suggestion.suggestedChange,
          category: suggestion.category,
          reasonText: suggestion.reasonText
        });
      }

      logEvent({
        sessionId,
        trialIndex: trial.trial_index,
        eventType: "ai_call",
        payload: { action: body.action, aiCallId }
      });

      return NextResponse.json({ suggestions: responseSuggestions, aiCallId });
    }

    const bullets = body.bullets?.map((item) => item.trim()).filter(Boolean) ?? [];
    if (bullets.length < 3) {
      throw new Error("Thought Partner requires initial bullet input.");
    }

    const requestType = body.action === "thought_partner_questions" ? "questions" : "summary";
    const ai = await generateThoughtPartnerOutput({
      scenario,
      bullets,
      reflections: body.reflections,
      requestType
    });
    const parsed = thoughtPartnerOutputSchema.parse(ai.parsed);

    const result = db
      .prepare(
        `
        INSERT INTO ai_calls (session_id, trial_index, condition, stage, request_json, response_json, validated_json, is_valid, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
        `
      )
      .run(
        sessionId,
        trial.trial_index,
        trial.condition,
        requestType,
        JSON.stringify({
          systemPrompt: ai.systemPrompt,
          userPrompt: ai.userPrompt,
          reflections: body.reflections ?? []
        }),
        JSON.stringify({ rawText: ai.rawText }),
        JSON.stringify(parsed),
        createdAt
      );

    logEvent({
      sessionId,
      trialIndex: trial.trial_index,
      eventType: "ai_call",
      payload: { action: body.action, aiCallId: result.lastInsertRowid }
    });

    return NextResponse.json({ thoughtPartner: parsed, aiCallId: result.lastInsertRowid });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
