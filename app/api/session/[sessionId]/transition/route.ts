import { transitionSessionState } from "@/lib/sessionManager";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  toState: z.enum([
    "pre_survey",
    "practice_intro",
    "practice_task",
    "practice_survey",
    "scenario_intro",
    "bullet_input",
    "human_drafting",
    "ai_generation",
    "ai_revision",
    "reflection_questions",
    "reflection_summary",
    "independent_drafting",
    "final_edit",
    "post_condition_survey",
    "inter_condition_buffer",
    "post_study_survey"
  ]),
  payload: z.unknown().optional(),
  preEditorMessageText: z.string().optional()
});

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse> {
  try {
    const { sessionId } = await context.params;
    const parsed = bodySchema.parse(await request.json());
    const result = transitionSessionState({
      sessionId,
      toState: parsed.toState,
      payload: parsed.payload,
      preEditorMessageText: parsed.preEditorMessageText
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
