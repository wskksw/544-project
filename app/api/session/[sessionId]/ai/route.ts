import {
  editorSuggestionsSchema,
  generateEditorSuggestions,
  generateGhostWriterDraft,
  generatePracticeNudge,
  generateThoughtPartnerOutput,
  thoughtPartnerOutputSchema
} from "@/lib/ai";
import { db } from "@/lib/db";
import { logEvent, nowIso } from "@/lib/logger";
import { getSessionSnapshot } from "@/lib/sessionManager";
import type { RoleCondition } from "@/lib/types";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  action: z.enum([
    "ghost_writer_generate",
    "editor_suggest",
    "thought_partner_questions",
    "practice_nudge"
  ]),
  bullets: z.array(z.string()).optional(),
  message: z.string().optional()
});

function expectedCondition(action: z.infer<typeof bodySchema>["action"]): RoleCondition | null {
  if (action === "ghost_writer_generate") {
    return "ghost_writer";
  }
  if (action === "editor_suggest") {
    return "editor";
  }
  if (action === "thought_partner_questions") {
    return "thought_partner";
  }
  return null; // practice_nudge has no condition requirement
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

    const condition = expectedCondition(body.action);
    if (condition !== null && trial.condition !== condition) {
      throw new Error(`Action ${body.action} does not match active condition ${trial.condition}.`);
    }

    const createdAt = nowIso();

    if (body.action === "practice_nudge") {
      const message = (body.message ?? "").trim();
      if (!message) {
        throw new Error("Practice nudge requires a message.");
      }

      const ai = await generatePracticeNudge({ userMessage: message });

      logEvent({
        sessionId,
        trialIndex: null,
        eventType: "ai_call",
        payload: { action: body.action, nudge: ai.nudge }
      });

      return NextResponse.json({ nudge: ai.nudge });
    }

    if (body.action === "ghost_writer_generate") {
      const bullets = body.bullets?.map((item) => item.trim()).filter(Boolean) ?? [];
      if (bullets.length < 3 || bullets.length > 5) {
        throw new Error("Drafter Assistant requires 3-5 bullets before generation.");
      }

      const ai = await generateGhostWriterDraft({ bullets });
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
        throw new Error("Editor Assistant requires a full human-written message.");
      }

      const ai = await generateEditorSuggestions({ message });
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
        category: "tone" | "specificity" | "empathy" | "clarity";
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

    // thought_partner_questions
    const bullets = body.bullets?.map((item) => item.trim()).filter(Boolean) ?? [];
    if (bullets.length < 3) {
      throw new Error("Brainstorm Assistant requires initial bullet input.");
    }

    const ai = await generateThoughtPartnerOutput({ bullets });
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
        "questions",
        JSON.stringify({
          systemPrompt: ai.systemPrompt,
          userPrompt: ai.userPrompt
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

    return NextResponse.json({
      thoughtPartner: { reflectiveQuestions: parsed },
      aiCallId: result.lastInsertRowid
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
