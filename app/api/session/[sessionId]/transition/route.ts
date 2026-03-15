import { transitionSessionState } from "@/lib/sessionManager";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  toState: z.enum([
    "scenario_intro",
    "bullet_input",
    "human_drafting",
    "ai_generation",
    "ai_revision",
    "reflection_questions",
    "reflection_summary",
    "independent_drafting",
    "optional_feedback",
    "final_edit",
    "post_condition_survey",
    "inter_condition_buffer"
  ]),
  payload: z.unknown().optional()
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
      payload: parsed.payload
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
