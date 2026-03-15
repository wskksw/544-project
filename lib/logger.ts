import { db } from "@/lib/db";
import type { StudyState } from "@/lib/types";

export function nowIso(): string {
  return new Date().toISOString();
}

export function logEvent(params: {
  sessionId: string;
  trialIndex: number | null;
  eventType: string;
  stateFrom?: StudyState | null;
  stateTo?: StudyState | null;
  payload?: unknown;
  timestamp?: string;
}): void {
  db.prepare(
    `
    INSERT INTO events (session_id, trial_index, event_type, state_from, state_to, created_at, payload_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    params.sessionId,
    params.trialIndex,
    params.eventType,
    params.stateFrom ?? null,
    params.stateTo ?? null,
    params.timestamp ?? nowIso(),
    params.payload === undefined ? null : JSON.stringify(params.payload)
  );
}

export function logTransition(params: {
  sessionId: string;
  trialIndex: number;
  from: StudyState;
  to: StudyState;
  payload?: unknown;
}): void {
  logEvent({
    sessionId: params.sessionId,
    trialIndex: params.trialIndex,
    eventType: "state_transition",
    stateFrom: params.from,
    stateTo: params.to,
    payload: params.payload
  });
}
