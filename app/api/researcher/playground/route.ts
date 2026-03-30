import { createPlaygroundSession } from "@/lib/sessionManager";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  condition: z.enum(["thought_partner", "editor", "ghost_writer"]),
  scenarioId: z.string().min(1)
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const parsed = bodySchema.parse(await request.json());
    const sessionId = createPlaygroundSession(parsed);
    return NextResponse.json({ sessionId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
