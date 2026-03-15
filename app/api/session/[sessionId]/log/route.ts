import { logEvent } from "@/lib/logger";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  trialIndex: z.number().int().nullable(),
  eventType: z.string().min(1),
  payload: z.unknown().optional()
});

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse> {
  try {
    const { sessionId } = await context.params;
    const parsed = bodySchema.parse(await request.json());
    logEvent({
      sessionId,
      trialIndex: parsed.trialIndex,
      eventType: parsed.eventType,
      payload: parsed.payload
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
