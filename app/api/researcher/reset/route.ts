import { wipeAllParticipantData } from "@/lib/sessionManager";
import { NextResponse } from "next/server";

export async function DELETE(): Promise<NextResponse> {
  try {
    const result = wipeAllParticipantData();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
