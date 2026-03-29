import { updateParticipantLabel } from "@/lib/sessionManager";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  participantLabel: z.string().min(1)
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ participantId: string }> }
): Promise<NextResponse> {
  try {
    const { participantId } = await context.params;
    const parsed = bodySchema.parse(await request.json());
    const result = updateParticipantLabel({
      participantId,
      participantLabel: parsed.participantLabel
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
