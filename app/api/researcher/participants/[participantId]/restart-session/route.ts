import { restartParticipantSession } from "@/lib/sessionManager";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ participantId: string }> }
): Promise<NextResponse> {
  try {
    const { participantId } = await context.params;
    const result = restartParticipantSession({ participantId });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
