import { db } from "@/lib/db";
import { logEvent } from "@/lib/logger";
import { getSessionSnapshot } from "@/lib/sessionManager";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  suggestionId: z.number().int().positive(),
  actionStatus: z.enum(["accept", "reject", "modify"]),
  userModifiedText: z.string().nullable().optional()
});

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse> {
  try {
    const { sessionId } = await context.params;
    const parsed = bodySchema.parse(await request.json());
    const snapshot = getSessionSnapshot(sessionId);

    const result = db
      .prepare(
        `
        UPDATE editor_suggestions
        SET action_status = ?, user_modified_text = ?
        WHERE id = ?
        `
      )
      .run(parsed.actionStatus, parsed.userModifiedText ?? null, parsed.suggestionId);

    if (result.changes === 0) {
      throw new Error("Suggestion record not found.");
    }

    logEvent({
      sessionId,
      trialIndex: snapshot.currentTrial.trial_index,
      eventType: "editor_suggestion_action",
      payload: parsed
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
