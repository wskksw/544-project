import { enrollStudyParticipant } from "@/lib/sessionManager";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  responses: z.record(z.unknown())
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const parsed = bodySchema.parse(await request.json());
    return NextResponse.json(enrollStudyParticipant({ responses: parsed.responses }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
