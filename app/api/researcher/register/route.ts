import { registerParticipant } from "@/lib/sessionManager";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  participantId: z.string().min(1),
  targetN: z.number().int().positive().optional()
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const json = await request.json();
    const parsed = bodySchema.parse(json);
    const result = registerParticipant(parsed);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
