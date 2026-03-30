import { submitPractice } from "@/lib/sessionManager";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  practiceMessageText: z.string(),
  surveyResponses: z.record(z.unknown())
});

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse> {
  try {
    const { sessionId } = await context.params;
    const parsed = bodySchema.parse(await request.json());

    const result = submitPractice({
      sessionId,
      practiceMessageText: parsed.practiceMessageText,
      surveyResponses: parsed.surveyResponses
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
