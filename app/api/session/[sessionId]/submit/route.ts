import { submitTrial } from "@/lib/sessionManager";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  surveyResponses: z.record(z.unknown()),
  finalMessageText: z.string(),
  thoughtPartnerResponses: z
    .array(
      z.object({
        questionOrder: z.number().int().min(1),
        question: z.string().min(1),
        response: z.string().min(1)
      })
    )
    .optional(),
  interactionMetrics: z
    .object({
      keystrokeCount: z.number().int().min(0).optional(),
      selfAuthoredTextRatio: z.number().min(0).max(1).nullable().optional(),
      ghostWriterEditCount: z.number().int().min(0).nullable().optional(),
      reflectionDurationSec: z.number().int().min(0).nullable().optional()
    })
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
      thoughtPartnerResponses: parsed.thoughtPartnerResponses,
      interactionMetrics: parsed.interactionMetrics
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
