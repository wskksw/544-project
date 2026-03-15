import { submitTrial } from "@/lib/sessionManager";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  surveyResponses: z.record(z.unknown()),
  finalMessageText: z.string(),
  revisorActions: z.unknown().optional(),
  facilitatorResponses: z
    .array(z.object({ question: z.string().min(1), response: z.string().min(1) }))
    .optional()
});

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse> {
  try {
    const { sessionId } = await context.params;
    const parsed = bodySchema.parse(await request.json());

    const result = submitTrial({
      sessionId,
      surveyResponses: parsed.surveyResponses,
      finalMessageText: parsed.finalMessageText,
      revisorActions: parsed.revisorActions,
      facilitatorResponses: parsed.facilitatorResponses
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
