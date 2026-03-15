import {
  facilitatorOutputSchema,
  generateDrafterDraft,
  generateFacilitatorOutput,
  generateRevisorSuggestions,
  revisorSuggestionsSchema
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
    "drafter_generate",
    "revisor_suggest",
    "facilitator_questions",
    "facilitator_summary",
    "facilitator_feedback"
  ]),
  bullets: z.array(z.string()).optional(),
  message: z.string().optional(),
  reflections: z
    .array(z.object({ question: z.string().min(1), response: z.string().min(1) }))
    .optional(),
  draftMessage: z.string().optional()
});

function expectedCondition(action: z.infer<typeof bodySchema>["action"]): RoleCondition {
  if (action === "drafter_generate") {
    return "drafter";
  }
  if (action === "revisor_suggest") {
    return "revisor";
  }
  return "facilitator";
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

    if (body.action === "drafter_generate") {
      const bullets = body.bullets?.map((item) => item.trim()).filter(Boolean) ?? [];
      if (bullets.length < 3 || bullets.length > 5) {
        throw new Error("Drafter requires 3-5 bullets before generation.");
      }

      const ai = await generateDrafterDraft({ scenario, bullets });
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

    if (body.action === "revisor_suggest") {
      const message = (body.message ?? "").trim();
      if (!message) {
        throw new Error("Revisor requires a full human-written message.");
      }

      const ai = await generateRevisorSuggestions({ scenario, message });
      const parsed = revisorSuggestionsSchema.parse(ai.parsed);

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
        INSERT INTO revisor_suggestions (ai_call_id, segment_original, suggested_change, reason_tag, action_status)
        VALUES (?, ?, ?, ?, 'pending')
        `
      );

      const responseSuggestions: Array<{
        id: number;
        originalSegment: string;
        suggestedChange: string;
        reasonTag: "tone" | "clarity" | "empathy";
      }> = [];

      for (const suggestion of parsed.suggestions) {
        const insertResult = insertSuggestion.run(
          aiCallId,
          suggestion.originalSegment,
          suggestion.suggestedChange,
          suggestion.reasonTag
        );
        responseSuggestions.push({
          id: Number(insertResult.lastInsertRowid),
          originalSegment: suggestion.originalSegment,
          suggestedChange: suggestion.suggestedChange,
          reasonTag: suggestion.reasonTag
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
      throw new Error("Facilitator requires initial bullet input.");
    }

    const requestType =
      body.action === "facilitator_questions"
        ? "questions"
        : body.action === "facilitator_summary"
          ? "summary"
          : "feedback";

    const ai = await generateFacilitatorOutput({
      scenario,
      bullets,
      reflections: body.reflections,
      requestType,
      draftMessage: body.draftMessage
    });

    const parsed = facilitatorOutputSchema.parse(ai.parsed);

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

    const aiCallId = Number(result.lastInsertRowid);

    logEvent({
      sessionId,
      trialIndex: trial.trial_index,
      eventType: "ai_call",
      payload: { action: body.action, aiCallId }
    });

    return NextResponse.json({ facilitator: parsed, aiCallId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
