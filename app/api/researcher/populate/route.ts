import { populateParticipantsToTargetN } from "@/lib/sessionManager";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  targetN: z.number().int().positive().optional()
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const parsed = bodySchema.parse(await request.json());
    const result = populateParticipantsToTargetN({ targetN: parsed.targetN });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
