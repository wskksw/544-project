import { randomUUID } from "node:crypto";
import { DEFAULT_TARGET_N, getCounterbalanceCells } from "@/lib/constants";
import { db } from "@/lib/db";
import { logEvent, logTransition, nowIso } from "@/lib/logger";
import { getScenarioById } from "@/lib/scenarios";
import { canTransition } from "@/lib/stateMachine";
import { ensureSurveyTemplatesSeeded } from "@/lib/surveys";
import type {
  AssignmentCell,
  RoleCondition,
  SessionStatus,
  StudyState,
  TrialPlan
} from "@/lib/types";

ensureSurveyTemplatesSeeded();

type AssignmentRow = {
  participant_id: string;
  cell_id: string;
  target_n: number;
  assigned_manually: number;
  created_at: string;
};

type SessionRow = {
  id: string;
  participant_id: string;
  participant_label: string;
  access_code: string;
  is_playground: number;
  status: SessionStatus;
  current_trial_index: number;
  current_state: StudyState;
  created_at: string;
  updated_at: string;
};

type TrialRow = {
  trial_index: number;
  scenario_id: string;
  condition: RoleCondition;
  order_position: number;
  status: "pending" | "active" | "completed";
  started_at: string | null;
  completed_at: string | null;
  final_message_text: string | null;
};

type PreStudySurveyRow = {
  responses_json: string;
};

const ACCESS_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function assertTargetN(targetN: number): void {
  if (!Number.isFinite(targetN) || targetN <= 0 || targetN % 3 !== 0) {
    throw new Error("Target N must be a positive multiple of 3.");
  }
}

function getTargetNInfo(): { count: number; distinctCount: number; currentTargetN: number | null } {
  return db
    .prepare(
      "SELECT COUNT(*) as count, COUNT(DISTINCT target_n) as distinctCount, MIN(target_n) as currentTargetN FROM assignments"
    )
    .get() as { count: number; distinctCount: number; currentTargetN: number | null };
}

function buildTrials(cell: AssignmentCell): TrialPlan[] {
  return cell.trialSpecs.map((trial, index) => ({
    trialIndex: index,
    scenarioId: trial.scenarioId,
    condition: trial.condition,
    orderPosition: index + 1,
    status: "pending"
  }));
}

function randomCodeSegment(length: number): string {
  let result = "";
  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * ACCESS_CODE_CHARS.length);
    result += ACCESS_CODE_CHARS[randomIndex];
  }
  return result;
}

function generateUniqueAccessCode(): string {
  for (let attempts = 0; attempts < 100; attempts += 1) {
    const candidate = `AIMC-${randomCodeSegment(4)}`;
    const existing = db
      .prepare("SELECT 1 FROM participants WHERE access_code = ?")
      .get(candidate) as { 1: number } | undefined;
    if (!existing) {
      return candidate;
    }
  }

  throw new Error("Failed to generate unique access code.");
}

function createSessionInternal(participantId: string, trials: TrialPlan[], isPlayground: boolean): string {
  const sessionId = randomUUID();
  const createdAt = nowIso();
  const initialState: StudyState = isPlayground ? "scenario_intro" : "pre_survey";

  db.prepare(
    `
    INSERT INTO sessions (id, participant_id, is_playground, status, current_trial_index, current_state, created_at, updated_at)
    VALUES (?, ?, ?, 'active', 0, ?, ?, ?)
    `
  ).run(sessionId, participantId, isPlayground ? 1 : 0, initialState, createdAt, createdAt);

  const insertTrial = db.prepare(
    `
    INSERT INTO trial_plan (
      session_id, trial_index, scenario_id, condition, order_position, status, started_at, completed_at, final_message_text
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)
    `
  );

  for (const trial of trials) {
    insertTrial.run(
      sessionId,
      trial.trialIndex,
      trial.scenarioId,
      trial.condition,
      trial.orderPosition,
      trial.status,
      null
    );
  }

  logEvent({
    sessionId,
    trialIndex: 0,
    eventType: "session_created",
    payload: { participantId, isPlayground, trials },
    timestamp: createdAt
  });

  return sessionId;
}

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function clampRatio(value: number | null): number | null {
  if (value === null || Number.isNaN(value)) {
    return null;
  }
  return Math.max(0, Math.min(1, value));
}

function persistTrialMetrics(params: {
  sessionId: string;
  trialIndex: number;
  condition: RoleCondition;
  scenarioId: string;
  startedAt: string | null;
  completedAt: string;
  finalMessageText: string;
  interactionMetrics?: {
    keystrokeCount?: number;
    selfAuthoredTextRatio?: number | null;
    ghostWriterEditCount?: number | null;
    reflectionDurationSec?: number | null;
  };
}): void {
  const completionTimeSec = params.startedAt
    ? Math.max(0, Math.floor((new Date(params.completedAt).getTime() - new Date(params.startedAt).getTime()) / 1000))
    : 0;

  const suggestionRows =
    params.condition === "editor"
      ? (db
        .prepare("SELECT action_status FROM editor_suggestions es JOIN ai_calls ac ON ac.id = es.ai_call_id WHERE ac.session_id = ? AND ac.trial_index = ?")
        .all(params.sessionId, params.trialIndex) as Array<{ action_status: string }>)
      : [];

  const acceptedSuggestions = suggestionRows.filter((row) => row.action_status === "accept").length;
  const suggestionAcceptanceRate =
    suggestionRows.length > 0 ? acceptedSuggestions / suggestionRows.length : null;

  db.prepare(
    `
    INSERT OR REPLACE INTO trial_metrics (
      session_id, trial_index, condition, scenario_id, completion_time_sec, word_count, keystroke_count,
      self_authored_text_ratio, suggestion_acceptance_rate, ghost_writer_edit_count, reflection_duration_sec, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    params.sessionId,
    params.trialIndex,
    params.condition,
    params.scenarioId,
    completionTimeSec,
    wordCount(params.finalMessageText),
    Math.max(0, params.interactionMetrics?.keystrokeCount ?? 0),
    clampRatio(params.interactionMetrics?.selfAuthoredTextRatio ?? null),
    suggestionAcceptanceRate,
    params.condition === "ghost_writer"
      ? Math.max(0, params.interactionMetrics?.ghostWriterEditCount ?? 0)
      : null,
    params.condition === "thought_partner"
      ? Math.max(0, params.interactionMetrics?.reflectionDurationSec ?? 0)
      : null,
    params.completedAt
  );
}

export function registerParticipant(params: {
  participantLabel?: string;
  targetN?: number;
}): {
  participant: { id: string; participantLabel: string; accessCode: string };
  assignment: AssignmentRow;
  trials: TrialPlan[];
  sessionId: string;
} {
  const participantLabel = (params.participantLabel ?? "").trim() || `Participant ${randomCodeSegment(3)}`;

  return db.transaction(() => {
    const targetInfo = getTargetNInfo();
    if (targetInfo.distinctCount > 1) {
      throw new Error("Inconsistent target N values detected in assignments. Reset data before continuing.");
    }

    const currentTargetN = targetInfo.count > 0 ? targetInfo.currentTargetN : null;
    const targetN = params.targetN ?? currentTargetN ?? DEFAULT_TARGET_N;
    assertTargetN(targetN);

    if (targetInfo.count > targetN) {
      throw new Error(
        `Current participant count (${targetInfo.count}) exceeds target N (${targetN}). Increase target N or reset data.`
      );
    }

    if (currentTargetN !== null && targetN !== currentTargetN) {
      db.prepare("UPDATE assignments SET target_n = ?").run(targetN);
    }

    const counts = db
      .prepare("SELECT cell_id as cellId, COUNT(*) as count FROM assignments GROUP BY cell_id")
      .all() as Array<{ cellId: string; count: number }>;

    const countMap = new Map<string, number>();
    for (const row of counts) {
      countMap.set(row.cellId, row.count);
    }

    const quotaPerCell = targetN / 3;
    const candidates = getCounterbalanceCells()
      .map((cell) => ({ cell, count: countMap.get(cell.cellId) ?? 0 }))
      .filter((entry) => entry.count < quotaPerCell)
      .sort((a, b) => (a.count === b.count ? a.cell.cellId.localeCompare(b.cell.cellId) : a.count - b.count));

    if (candidates.length === 0) {
      throw new Error(`All assignment cells are full for target N=${targetN}. Increase target N.`);
    }

    const selectedCell = candidates[0].cell;
    const participantId = randomUUID();
    const accessCode = generateUniqueAccessCode();
    const createdAt = nowIso();

    db.prepare(
      "INSERT INTO participants (id, participant_label, access_code, created_at) VALUES (?, ?, ?, ?)"
    ).run(participantId, participantLabel, accessCode, createdAt);

    db.prepare(
      "INSERT INTO assignments (participant_id, cell_id, target_n, assigned_manually, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(participantId, selectedCell.cellId, targetN, 0, createdAt);

    const assignment = db
      .prepare("SELECT * FROM assignments WHERE participant_id = ?")
      .get(participantId) as AssignmentRow | undefined;

    if (!assignment) {
      throw new Error("Failed to persist assignment.");
    }

    const trials = buildTrials(selectedCell);
    const sessionId = createSessionInternal(participantId, trials, false);

    return {
      participant: { id: participantId, participantLabel, accessCode },
      assignment,
      trials,
      sessionId
    };
  })();
}

export function populateParticipantsToTargetN(params: { targetN?: number }): {
  targetN: number;
  existing: number;
  created: number;
  total: number;
  participants: Array<{
    participantId: string;
    participantLabel: string;
    accessCode: string;
    cellId: string;
    sessionId: string;
  }>;
} {
  const targetInfo = getTargetNInfo();
  if (targetInfo.distinctCount > 1) {
    throw new Error("Inconsistent target N values detected in assignments. Reset data before continuing.");
  }

  const currentTargetN = targetInfo.count > 0 ? targetInfo.currentTargetN : null;
  const targetN = params.targetN ?? currentTargetN ?? DEFAULT_TARGET_N;
  assertTargetN(targetN);

  if (currentTargetN !== null && targetN !== currentTargetN) {
    db.prepare("UPDATE assignments SET target_n = ?").run(targetN);
  }

  const existing = targetInfo.count;
  if (existing > targetN) {
    throw new Error(
      `Current participant count (${existing}) already exceeds target N (${targetN}). Increase target N or reset data.`
    );
  }

  const missing = targetN - existing;
  const participants: Array<{
    participantId: string;
    participantLabel: string;
    accessCode: string;
    cellId: string;
    sessionId: string;
  }> = [];

  for (let index = 0; index < missing; index += 1) {
    const participantLabel = `P${String(existing + index + 1).padStart(3, "0")}`;
    const created = registerParticipant({ participantLabel, targetN });
    participants.push({
      participantId: created.participant.id,
      participantLabel: created.participant.participantLabel,
      accessCode: created.participant.accessCode,
      cellId: created.assignment.cell_id,
      sessionId: created.sessionId
    });
  }

  return { targetN, existing, created: missing, total: targetN, participants };
}

export function updateParticipantLabel(params: {
  participantId: string;
  participantLabel: string;
}): { participantId: string; participantLabel: string; accessCode: string } {
  const participantId = params.participantId.trim();
  const participantLabel = params.participantLabel.trim();

  if (!participantId) {
    throw new Error("Participant ID is required.");
  }
  if (!participantLabel) {
    throw new Error("Participant label is required.");
  }

  const result = db
    .prepare("UPDATE participants SET participant_label = ? WHERE id = ?")
    .run(participantLabel, participantId);

  if (result.changes === 0) {
    throw new Error("Participant not found.");
  }

  const row = db
    .prepare("SELECT id, participant_label, access_code FROM participants WHERE id = ?")
    .get(participantId) as { id: string; participant_label: string; access_code: string } | undefined;

  if (!row) {
    throw new Error("Participant not found after update.");
  }

  return {
    participantId: row.id,
    participantLabel: row.participant_label,
    accessCode: row.access_code
  };
}

export function restartParticipantSession(params: {
  participantId: string;
}): { sessionId: string; participantId: string; participantLabel: string; accessCode: string } {
  const participantId = params.participantId.trim();
  if (!participantId) {
    throw new Error("Participant ID is required.");
  }

  return db.transaction(() => {
    const participant = db
      .prepare("SELECT id, participant_label, access_code FROM participants WHERE id = ?")
      .get(participantId) as { id: string; participant_label: string; access_code: string } | undefined;

    if (!participant) {
      throw new Error("Participant not found.");
    }

    const assignment = db
      .prepare("SELECT cell_id FROM assignments WHERE participant_id = ?")
      .get(participantId) as { cell_id: string } | undefined;

    if (!assignment) {
      throw new Error("Assignment not found for participant.");
    }

    const cell = getCounterbalanceCells().find((entry) => entry.cellId === assignment.cell_id);
    if (!cell) {
      throw new Error("Assigned counterbalance cell is invalid.");
    }

    const now = nowIso();
    db.prepare("UPDATE sessions SET status = 'completed', updated_at = ? WHERE participant_id = ? AND is_playground = 0 AND status = 'active'").run(
      now,
      participantId
    );

    const sessionId = createSessionInternal(participantId, buildTrials(cell), false);

    logEvent({
      sessionId,
      trialIndex: null,
      eventType: "participant_session_restarted",
      payload: { participantId },
      timestamp: nowIso()
    });

    return {
      sessionId,
      participantId: participant.id,
      participantLabel: participant.participant_label,
      accessCode: participant.access_code
    };
  })();
}

export function wipeAllParticipantData(): {
  deletedParticipants: number;
  deletedAssignments: number;
  deletedSessions: number;
} {
  return db.transaction(() => {
    const counts = {
      deletedParticipants: (db.prepare("SELECT COUNT(*) as count FROM participants").get() as { count: number }).count,
      deletedAssignments: (db.prepare("SELECT COUNT(*) as count FROM assignments").get() as { count: number }).count,
      deletedSessions: (db.prepare("SELECT COUNT(*) as count FROM sessions").get() as { count: number }).count
    };

    // Deleting participants cascades into assignments, sessions, trial data, events, and surveys.
    db.prepare("DELETE FROM participants").run();

    return counts;
  })();
}

export function createPlaygroundSession(params: {
  condition: RoleCondition;
  scenarioId: string;
}): string {
  getScenarioById(params.scenarioId);

  return db.transaction(() => {
    const participantId = `playground-${randomUUID().slice(0, 8)}`;
    const createdAt = nowIso();

    db.prepare(
      "INSERT INTO participants (id, participant_label, access_code, created_at) VALUES (?, ?, ?, ?)"
    ).run(participantId, "Playground Tester", `PLAY-${randomCodeSegment(4)}`, createdAt);

    const trial: TrialPlan = {
      trialIndex: 0,
      scenarioId: params.scenarioId,
      condition: params.condition,
      orderPosition: 1,
      status: "pending"
    };

    return createSessionInternal(participantId, [trial], true);
  })();
}

export function resolveSessionByAccessCode(accessCode: string): {
  sessionId: string;
  status: SessionStatus;
  participantLabel: string;
  accessCode: string;
} {
  const normalized = accessCode.trim().toUpperCase();
  if (!normalized) {
    throw new Error("Access code is required.");
  }

  const participant = db
    .prepare("SELECT id, participant_label, access_code FROM participants WHERE UPPER(access_code) = UPPER(?)")
    .get(normalized) as { id: string; participant_label: string; access_code: string } | undefined;

  if (!participant) {
    throw new Error("Access code not found.");
  }

  const session = db
    .prepare(
      `
      SELECT id, status
      FROM sessions
      WHERE participant_id = ? AND is_playground = 0
      ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, updated_at DESC
      LIMIT 1
      `
    )
    .get(participant.id) as { id: string; status: SessionStatus } | undefined;

  if (!session) {
    throw new Error("No study session found for this participant.");
  }

  return {
    sessionId: session.id,
    status: session.status,
    participantLabel: participant.participant_label,
    accessCode: participant.access_code
  };
}

export function getSessionSnapshot(sessionId: string): {
  session: SessionRow;
  currentTrial: TrialRow;
  allTrials: TrialRow[];
  preStudySurveyResponses: Record<string, unknown> | null;
} {
  const session = db
    .prepare(
      `
      SELECT s.*, p.participant_label, p.access_code
      FROM sessions s
      JOIN participants p ON p.id = s.participant_id
      WHERE s.id = ?
      `
    )
    .get(sessionId) as SessionRow | undefined;

  if (!session) {
    throw new Error("Session not found.");
  }

  const allTrials = db
    .prepare(
      "SELECT trial_index, scenario_id, condition, order_position, status, started_at, completed_at, final_message_text FROM trial_plan WHERE session_id = ? ORDER BY trial_index"
    )
    .all(sessionId) as TrialRow[];

  const currentTrial = allTrials.find((trial) => trial.trial_index === session.current_trial_index);
  if (!currentTrial) {
    throw new Error("Current trial not found.");
  }

  const preStudySurvey = db
    .prepare(
      "SELECT responses_json FROM pre_study_surveys WHERE session_id = ? ORDER BY created_at DESC LIMIT 1"
    )
    .get(sessionId) as PreStudySurveyRow | undefined;

  let preStudySurveyResponses: Record<string, unknown> | null = null;
  if (preStudySurvey) {
    try {
      const parsed = JSON.parse(preStudySurvey.responses_json) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        preStudySurveyResponses = parsed as Record<string, unknown>;
      }
    } catch {
      preStudySurveyResponses = null;
    }
  }

  return { session, currentTrial, allTrials, preStudySurveyResponses };
}

export function transitionSessionState(params: {
  sessionId: string;
  toState: StudyState;
  payload?: unknown;
}): { currentState: StudyState; trialIndex: number } {
  return db.transaction(() => {
    const snapshot = getSessionSnapshot(params.sessionId);
    if (snapshot.session.status !== "active") {
      throw new Error("Session is not active.");
    }
    if (snapshot.session.current_state === "post_study_survey") {
      throw new Error("Final post-study survey must be submitted before session completion.");
    }
    if (!canTransition(snapshot.currentTrial.condition, snapshot.session.current_state, params.toState)) {
      throw new Error(
        `Invalid transition for condition ${snapshot.currentTrial.condition}: ${snapshot.session.current_state} -> ${params.toState}`
      );
    }

    db.prepare("UPDATE sessions SET current_state = ?, updated_at = ? WHERE id = ?").run(
      params.toState,
      nowIso(),
      params.sessionId
    );

    logTransition({
      sessionId: params.sessionId,
      trialIndex: snapshot.currentTrial.trial_index,
      from: snapshot.session.current_state,
      to: params.toState,
      payload: params.payload
    });

    return {
      currentState: params.toState,
      trialIndex: snapshot.currentTrial.trial_index
    };
  })();
}

export function startCurrentTrial(sessionId: string): { trialIndex: number; startedAt: string } {
  return db.transaction(() => {
    const snapshot = getSessionSnapshot(sessionId);

    if (snapshot.session.status !== "active") {
      throw new Error("Session is not active.");
    }
    if (snapshot.session.current_state !== "scenario_intro") {
      throw new Error("Current trial can only be started from scenario_intro.");
    }
    if (snapshot.currentTrial.completed_at) {
      throw new Error("Current trial is already completed.");
    }
    if (snapshot.currentTrial.started_at) {
      return {
        trialIndex: snapshot.currentTrial.trial_index,
        startedAt: snapshot.currentTrial.started_at
      };
    }

    const startedAt = nowIso();
    db.prepare("UPDATE trial_plan SET status = 'active', started_at = ? WHERE session_id = ? AND trial_index = ?").run(
      startedAt,
      sessionId,
      snapshot.currentTrial.trial_index
    );
    db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(startedAt, sessionId);

    logEvent({
      sessionId,
      trialIndex: snapshot.currentTrial.trial_index,
      eventType: "trial_started",
      payload: { state: "scenario_intro" },
      timestamp: startedAt
    });

    return {
      trialIndex: snapshot.currentTrial.trial_index,
      startedAt
    };
  })();
}

export function submitTrial(params: {
  sessionId: string;
  surveyResponses: Record<string, unknown>;
  finalMessageText: string;
  thoughtPartnerResponses?: Array<{ questionOrder: number; question: string; response: string }>;
  interactionMetrics?: {
    keystrokeCount?: number;
    selfAuthoredTextRatio?: number | null;
    ghostWriterEditCount?: number | null;
    reflectionDurationSec?: number | null;
  };
}): {
  status: SessionStatus;
  currentTrialIndex: number;
  currentState: StudyState;
} {
  return db.transaction(
    (): { status: SessionStatus; currentTrialIndex: number; currentState: StudyState } => {
      const snapshot = getSessionSnapshot(params.sessionId);
      const session = snapshot.session;
      const trial = snapshot.currentTrial;

      if (session.status !== "active") {
        throw new Error("Session already completed.");
      }
      if (session.current_state !== "post_condition_survey") {
        throw new Error("Session must be in post_condition_survey before submit.");
      }

      const timestamp = nowIso();

      db.prepare("INSERT INTO surveys (session_id, trial_index, responses_json, created_at) VALUES (?, ?, ?, ?)").run(
        params.sessionId,
        trial.trial_index,
        JSON.stringify(params.surveyResponses),
        timestamp
      );

      if (params.thoughtPartnerResponses?.length) {
        const insertReflection = db.prepare(
          "INSERT INTO thought_partner_reflections (session_id, trial_index, question_order, question, response, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        );
        for (const pair of params.thoughtPartnerResponses) {
          insertReflection.run(
            params.sessionId,
            trial.trial_index,
            pair.questionOrder,
            pair.question,
            pair.response,
            timestamp
          );
        }
      }

      db.prepare(
        `
      UPDATE trial_plan
      SET status = 'completed', completed_at = ?, final_message_text = ?
      WHERE session_id = ? AND trial_index = ?
      `
      ).run(timestamp, params.finalMessageText, params.sessionId, trial.trial_index);

      persistTrialMetrics({
        sessionId: params.sessionId,
        trialIndex: trial.trial_index,
        condition: trial.condition,
        scenarioId: trial.scenario_id,
        startedAt: trial.started_at,
        completedAt: timestamp,
        finalMessageText: params.finalMessageText,
        interactionMetrics: params.interactionMetrics
      });

      logEvent({
        sessionId: params.sessionId,
        trialIndex: trial.trial_index,
        eventType: "trial_submitted",
        payload: {
          finalMessageLength: params.finalMessageText.length,
          interactionMetrics: params.interactionMetrics ?? null
        },
        timestamp
      });

      const nextTrial = snapshot.allTrials.find((candidate) => candidate.trial_index === trial.trial_index + 1);
      if (!nextTrial) {
        db.prepare("UPDATE sessions SET current_state = 'post_study_survey', updated_at = ? WHERE id = ?").run(
          timestamp,
          params.sessionId
        );

        logEvent({
          sessionId: params.sessionId,
          trialIndex: trial.trial_index,
          eventType: "awaiting_post_study_survey",
          payload: { finalTrialIndex: trial.trial_index },
          timestamp
        });

        return {
          status: "active",
          currentTrialIndex: trial.trial_index,
          currentState: "post_study_survey"
        };
      }

      logTransition({
        sessionId: params.sessionId,
        trialIndex: trial.trial_index,
        from: "post_condition_survey",
        to: "inter_condition_buffer",
        payload: { nextTrialIndex: nextTrial.trial_index }
      });

      db.prepare("UPDATE sessions SET current_trial_index = ?, current_state = 'inter_condition_buffer', updated_at = ? WHERE id = ?").run(
        nextTrial.trial_index,
        timestamp,
        params.sessionId
      );

      return {
        status: "active",
        currentTrialIndex: nextTrial.trial_index,
        currentState: "inter_condition_buffer"
      };
    }
  )();
}

export function submitPostStudySurvey(params: {
  sessionId: string;
  responses: Record<string, unknown>;
}): { status: SessionStatus; currentState: StudyState } {
  return db.transaction((): { status: SessionStatus; currentState: StudyState } => {
    const snapshot = getSessionSnapshot(params.sessionId);
    if (snapshot.session.status !== "active") {
      throw new Error("Session already completed.");
    }
    if (snapshot.session.current_state !== "post_study_survey") {
      throw new Error("Session is not waiting for post-study survey.");
    }

    const timestamp = nowIso();
    db.prepare("INSERT INTO post_study_surveys (session_id, responses_json, created_at) VALUES (?, ?, ?)").run(
      params.sessionId,
      JSON.stringify(params.responses),
      timestamp
    );
    db.prepare("UPDATE sessions SET status = 'completed', updated_at = ? WHERE id = ?").run(
      timestamp,
      params.sessionId
    );

    logEvent({
      sessionId: params.sessionId,
      trialIndex: snapshot.currentTrial.trial_index,
      eventType: "session_completed",
      payload: { via: "post_study_survey" },
      timestamp
    });

    return {
      status: "completed",
      currentState: "post_study_survey"
    };
  })();
}

export function submitPractice(params: {
  sessionId: string;
  practiceMessageText: string;
  surveyResponses: Record<string, unknown>;
}): { currentState: StudyState; currentTrialIndex: number } {
  return db.transaction((): { currentState: StudyState; currentTrialIndex: number } => {
    const snapshot = getSessionSnapshot(params.sessionId);

    if (snapshot.session.status !== "active") {
      throw new Error("Session is not active.");
    }

    if (snapshot.session.is_playground) {
      throw new Error("Playground sessions do not use the practice round.");
    }

    if (snapshot.session.current_state !== "practice_survey") {
      throw new Error("Practice survey is not currently active.");
    }

    const timestamp = nowIso();
    db.prepare("UPDATE sessions SET current_state = 'scenario_intro', updated_at = ? WHERE id = ?").run(
      timestamp,
      params.sessionId
    );

    logEvent({
      sessionId: params.sessionId,
      trialIndex: null,
      eventType: "practice_completed",
      payload: {
        practiceMessageText: params.practiceMessageText,
        surveyResponses: params.surveyResponses
      },
      timestamp
    });

    return {
      currentState: "scenario_intro",
      currentTrialIndex: snapshot.session.current_trial_index
    };
  })();
}

export function submitPreStudySurvey(params: {
  sessionId: string;
  responses: Record<string, unknown>;
}): { currentState: StudyState; currentTrialIndex: number } {
  return db.transaction((): { currentState: StudyState; currentTrialIndex: number } => {
    const snapshot = getSessionSnapshot(params.sessionId);

    if (snapshot.session.status !== "active") {
      throw new Error("Session is not active.");
    }

    if (snapshot.session.is_playground) {
      throw new Error("Playground sessions do not use the pre-survey.");
    }

    if (snapshot.session.current_state !== "pre_survey") {
      throw new Error("Pre-survey is not currently active.");
    }

    const timestamp = nowIso();
    db.prepare("INSERT INTO pre_study_surveys (session_id, responses_json, created_at) VALUES (?, ?, ?)").run(
      params.sessionId,
      JSON.stringify(params.responses),
      timestamp
    );

    db.prepare("UPDATE sessions SET current_state = 'practice_intro', updated_at = ? WHERE id = ?").run(
      timestamp,
      params.sessionId
    );

    logEvent({
      sessionId: params.sessionId,
      trialIndex: null,
      eventType: "pre_survey_submitted",
      payload: { surveyResponses: params.responses },
      timestamp
    });

    return {
      currentState: "practice_intro",
      currentTrialIndex: snapshot.session.current_trial_index
    };
  })();
}

export function getCompletionCode(sessionId: string): string {
  return `AIMC-${sessionId.slice(0, 8).toUpperCase()}`;
}

export function listAssignmentsAndSessions(): {
  cells: Array<{
    cellId: string;
    trialSpecs: AssignmentCell["trialSpecs"];
    count: number;
    participants: Array<{
      participantId: string;
      participantLabel: string;
      accessCode: string;
      sessionId: string | null;
      sessionStatus: string;
      currentState: StudyState | null;
      currentTrialIndex: number | null;
      completedTrials: number;
      totalTrials: number;
    }>;
  }>;
  sessions: Array<Record<string, unknown>>;
  currentTargetN: number | null;
} {
  const assignmentRows = db
    .prepare(
      `
      SELECT a.*, p.participant_label, p.access_code
      FROM assignments a
      JOIN participants p ON p.id = a.participant_id
      ORDER BY a.created_at DESC
      `
    )
    .all() as Array<AssignmentRow & { participant_label: string; access_code: string }>;

  const sessionRows = db
    .prepare(
      `
      SELECT s.id, s.participant_id, p.participant_label, p.access_code, s.status, s.current_trial_index,
             s.current_state, s.created_at, s.updated_at, tp.condition, tp.scenario_id
      FROM sessions s
      JOIN participants p ON p.id = s.participant_id
      LEFT JOIN trial_plan tp ON tp.session_id = s.id AND tp.trial_index = s.current_trial_index
      WHERE s.is_playground = 0
      ORDER BY s.updated_at DESC
      `
    )
    .all() as Array<Record<string, unknown>>;

  const progressRows = db
    .prepare(
      "SELECT session_id, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedTrials, COUNT(*) as totalTrials FROM trial_plan GROUP BY session_id"
    )
    .all() as Array<{ session_id: string; completedTrials: number; totalTrials: number }>;

  const progressMap = new Map<string, { completedTrials: number; totalTrials: number }>();
  for (const row of progressRows) {
    progressMap.set(row.session_id, {
      completedTrials: row.completedTrials,
      totalTrials: row.totalTrials
    });
  }

  const latestSessionByParticipant = new Map<string, Record<string, unknown>>();
  for (const session of sessionRows) {
    const participantId = String(session.participant_id);
    if (!latestSessionByParticipant.has(participantId)) {
      latestSessionByParticipant.set(participantId, session);
    }
  }

  const byCell = new Map<string, Array<{
    participantId: string;
    participantLabel: string;
    accessCode: string;
    sessionId: string | null;
    sessionStatus: string;
    currentState: StudyState | null;
    currentTrialIndex: number | null;
    completedTrials: number;
    totalTrials: number;
  }>>();

  for (const assignment of assignmentRows) {
    const latestSession = latestSessionByParticipant.get(assignment.participant_id);
    const sessionId = latestSession ? String(latestSession.id) : null;
    const progress = sessionId ? progressMap.get(sessionId) : undefined;

    const participantStatus = {
      participantId: assignment.participant_id,
      participantLabel: assignment.participant_label,
      accessCode: assignment.access_code,
      sessionId,
      sessionStatus: latestSession ? String(latestSession.status) : "none",
      currentState: latestSession ? (String(latestSession.current_state) as StudyState) : null,
      currentTrialIndex: latestSession ? Number(latestSession.current_trial_index) : null,
      completedTrials: progress?.completedTrials ?? 0,
      totalTrials: progress?.totalTrials ?? 0
    };

    const list = byCell.get(assignment.cell_id) ?? [];
    list.push(participantStatus);
    byCell.set(assignment.cell_id, list);
  }

  const cells = getCounterbalanceCells().map((cell) => ({
    cellId: cell.cellId,
    trialSpecs: cell.trialSpecs,
    count: (byCell.get(cell.cellId) ?? []).length,
    participants: (byCell.get(cell.cellId) ?? []).sort((a, b) =>
      a.participantLabel.localeCompare(b.participantLabel)
    )
  }));

  const targetInfo = getTargetNInfo();
  const currentTargetN =
    targetInfo.count > 0 && targetInfo.distinctCount === 1 ? targetInfo.currentTargetN : null;

  return { cells, sessions: sessionRows, currentTargetN };
}

export function exportAllData(): Record<string, unknown> {
  const tableNames = [
    "participants",
    "assignments",
    "sessions",
    "trial_plan",
    "events",
    "ai_calls",
    "editor_suggestions",
    "thought_partner_reflections",
    "pre_study_surveys",
    "surveys",
    "post_study_surveys",
    "survey_templates",
    "trial_metrics"
  ];

  const output: Record<string, unknown> = {};
  for (const tableName of tableNames) {
    output[tableName] = db.prepare(`SELECT * FROM ${tableName}`).all();
  }

  return output;
}
