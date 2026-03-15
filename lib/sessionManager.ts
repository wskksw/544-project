import { randomUUID } from "node:crypto";
import { DEFAULT_TARGET_N, getCounterbalanceCells } from "@/lib/constants";
import { db } from "@/lib/db";
import { logEvent, logTransition, nowIso } from "@/lib/logger";
import { getScenarioById } from "@/lib/scenarios";
import { canTransition, getInitialState } from "@/lib/stateMachine";
import type { AssignmentCell, RoleCondition, StudyState, TrialPlan } from "@/lib/types";

type AssignmentRow = {
  participant_id: string;
  cell_id: string;
  scenario_first: "scenario_1" | "scenario_2";
  pattern_id: "P1" | "P2" | "P3";
  target_n: number;
  created_at: string;
};

type SessionRow = {
  id: string;
  participant_id: string;
  is_playground: number;
  status: "active" | "completed";
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

function assertTargetN(targetN: number): void {
  if (!Number.isFinite(targetN) || targetN <= 0 || targetN % 6 !== 0) {
    throw new Error("Target N must be a positive multiple of 6.");
  }
}

function getCellMap(): Map<string, AssignmentCell> {
  const map = new Map<string, AssignmentCell>();
  for (const cell of getCounterbalanceCells()) {
    map.set(cell.cellId, cell);
  }
  return map;
}

function buildTrials(cell: AssignmentCell): TrialPlan[] {
  const firstScenario = cell.scenarioFirst;
  const secondScenario = firstScenario === "scenario_1" ? "scenario_2" : "scenario_1";
  const firstOrder = firstScenario === "scenario_1" ? cell.scenario1Order : cell.scenario2Order;
  const secondOrder = secondScenario === "scenario_1" ? cell.scenario1Order : cell.scenario2Order;

  const trials: TrialPlan[] = [];
  for (let idx = 0; idx < firstOrder.length; idx += 1) {
    trials.push({
      trialIndex: idx,
      scenarioId: firstScenario,
      condition: firstOrder[idx],
      orderPosition: idx + 1,
      status: idx === 0 ? "active" : "pending"
    });
  }

  for (let idx = 0; idx < secondOrder.length; idx += 1) {
    const trialIndex = idx + firstOrder.length;
    trials.push({
      trialIndex,
      scenarioId: secondScenario,
      condition: secondOrder[idx],
      orderPosition: trialIndex + 1,
      status: "pending"
    });
  }

  return trials;
}

function getAssignment(participantId: string): AssignmentRow | undefined {
  return db
    .prepare("SELECT * FROM assignments WHERE participant_id = ?")
    .get(participantId) as AssignmentRow | undefined;
}

export function registerParticipant(params: {
  participantId: string;
  targetN?: number;
}): { assignment: AssignmentRow; trials: TrialPlan[]; sessionId: string } {
  const participantId = params.participantId.trim();
  if (!participantId) {
    throw new Error("Participant ID is required.");
  }

  const targetN = params.targetN ?? DEFAULT_TARGET_N;
  assertTargetN(targetN);

  const cellMap = getCellMap();

  const transaction = db.transaction(() => {
    const existing = getAssignment(participantId);
    if (existing) {
      const existingSession = db
        .prepare(
          "SELECT id FROM sessions WHERE participant_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1"
        )
        .get(participantId) as { id: string } | undefined;

      if (existingSession) {
        const cell = cellMap.get(existing.cell_id);
        if (!cell) {
          throw new Error(`Assignment cell not found: ${existing.cell_id}`);
        }
        return {
          assignment: existing,
          trials: buildTrials(cell),
          sessionId: existingSession.id
        };
      }

      const cell = cellMap.get(existing.cell_id);
      if (!cell) {
        throw new Error(`Assignment cell not found: ${existing.cell_id}`);
      }
      const sessionId = createSessionInternal(participantId, buildTrials(cell), false);
      return {
        assignment: existing,
        trials: buildTrials(cell),
        sessionId
      };
    }

    const counts = db
      .prepare(
        "SELECT cell_id as cellId, COUNT(*) as count FROM assignments WHERE target_n = ? GROUP BY cell_id"
      )
      .all(targetN) as Array<{ cellId: string; count: number }>;

    const countMap = new Map<string, number>();
    for (const row of counts) {
      countMap.set(row.cellId, row.count);
    }

    const quotaPerCell = targetN / 6;
    const candidates = getCounterbalanceCells()
      .map((cell) => ({
        cell,
        count: countMap.get(cell.cellId) ?? 0
      }))
      .filter((entry) => entry.count < quotaPerCell)
      .sort((a, b) => {
        if (a.count === b.count) {
          return a.cell.cellId.localeCompare(b.cell.cellId);
        }
        return a.count - b.count;
      });

    if (candidates.length === 0) {
      throw new Error(
        `All assignment cells are full for target N=${targetN}. Increase target N or complete existing sessions.`
      );
    }

    const selected = candidates[0].cell;
    const createdAt = nowIso();
    db.prepare(
      `
      INSERT INTO assignments (participant_id, cell_id, scenario_first, pattern_id, target_n, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      `
    ).run(participantId, selected.cellId, selected.scenarioFirst, selected.patternId, targetN, createdAt);

    const assignment = getAssignment(participantId);
    if (!assignment) {
      throw new Error("Failed to persist assignment.");
    }

    const trials = buildTrials(selected);
    const sessionId = createSessionInternal(participantId, trials, false);

    return { assignment, trials, sessionId };
  });

  return transaction();
}

function createSessionInternal(participantId: string, trials: TrialPlan[], isPlayground: boolean): string {
  const sessionId = randomUUID();
  const createdAt = nowIso();
  const initialState = getInitialState();

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
      trial.status === "active" ? createdAt : null
    );
  }

  logEvent({
    sessionId,
    trialIndex: 0,
    eventType: "session_created",
    payload: {
      participantId,
      isPlayground,
      trials
    },
    timestamp: createdAt
  });

  return sessionId;
}

export function createPlaygroundSession(params: {
  condition: RoleCondition;
  scenarioId: string;
}): string {
  const participantId = `playground-${randomUUID().slice(0, 8)}`;
  getScenarioById(params.scenarioId);

  return db.transaction(() => {
    const trial: TrialPlan = {
      trialIndex: 0,
      scenarioId: params.scenarioId,
      condition: params.condition,
      orderPosition: 1,
      status: "active"
    };

    return createSessionInternal(participantId, [trial], true);
  })();
}

export function getSessionSnapshot(sessionId: string): {
  session: SessionRow;
  currentTrial: TrialRow;
  allTrials: TrialRow[];
} {
  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as
    | SessionRow
    | undefined;

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

  return { session, currentTrial, allTrials };
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

    const fromState = snapshot.session.current_state;
    const condition = snapshot.currentTrial.condition;

    if (!canTransition(condition, fromState, params.toState)) {
      throw new Error(
        `Invalid transition for condition ${condition}: ${fromState} -> ${params.toState}`
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
      from: fromState,
      to: params.toState,
      payload: params.payload
    });

    return {
      currentState: params.toState,
      trialIndex: snapshot.currentTrial.trial_index
    };
  })();
}

export function submitTrial(params: {
  sessionId: string;
  surveyResponses: Record<string, unknown>;
  finalMessageText: string;
  revisorActions?: unknown;
  facilitatorResponses?: Array<{ question: string; response: string }>;
}): {
  status: "active" | "completed";
  currentTrialIndex: number;
  currentState: StudyState;
} {
  const transaction = db.transaction(
    (): { status: "active" | "completed"; currentTrialIndex: number; currentState: StudyState } => {
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
    db.prepare(
      "INSERT INTO surveys (session_id, trial_index, responses_json, created_at) VALUES (?, ?, ?, ?)"
    ).run(params.sessionId, trial.trial_index, JSON.stringify(params.surveyResponses), timestamp);

    if (params.facilitatorResponses?.length) {
      const insertReflection = db.prepare(
        "INSERT INTO facilitator_reflections (session_id, trial_index, question, response, created_at) VALUES (?, ?, ?, ?, ?)"
      );
      for (const pair of params.facilitatorResponses) {
        insertReflection.run(params.sessionId, trial.trial_index, pair.question, pair.response, timestamp);
      }
    }

    db.prepare(
      `
      UPDATE trial_plan
      SET status = 'completed', completed_at = ?, final_message_text = ?
      WHERE session_id = ? AND trial_index = ?
      `
    ).run(timestamp, params.finalMessageText, params.sessionId, trial.trial_index);

    logEvent({
      sessionId: params.sessionId,
      trialIndex: trial.trial_index,
      eventType: "trial_submitted",
      payload: {
        revisorActions: params.revisorActions ?? null,
        finalMessageLength: params.finalMessageText.length
      },
      timestamp
    });

    const nextTrial = snapshot.allTrials.find((candidate) => candidate.trial_index === trial.trial_index + 1);

    if (!nextTrial) {
      db.prepare("UPDATE sessions SET status = 'completed', updated_at = ? WHERE id = ?").run(
        timestamp,
        params.sessionId
      );

      logEvent({
        sessionId: params.sessionId,
        trialIndex: trial.trial_index,
        eventType: "session_completed",
        payload: { finalTrialIndex: trial.trial_index },
        timestamp
      });

      return {
        status: "completed",
        currentTrialIndex: trial.trial_index,
        currentState: "post_condition_survey"
      };
    }

    logTransition({
      sessionId: params.sessionId,
      trialIndex: trial.trial_index,
      from: "post_condition_survey",
      to: "inter_condition_buffer",
      payload: { nextTrialIndex: nextTrial.trial_index }
    });

    db.prepare("UPDATE trial_plan SET status = 'active', started_at = ? WHERE session_id = ? AND trial_index = ?").run(
      timestamp,
      params.sessionId,
      nextTrial.trial_index
    );

    db.prepare(
      "UPDATE sessions SET current_trial_index = ?, current_state = 'scenario_intro', updated_at = ? WHERE id = ?"
    ).run(nextTrial.trial_index, timestamp, params.sessionId);

    logTransition({
      sessionId: params.sessionId,
      trialIndex: nextTrial.trial_index,
      from: "inter_condition_buffer",
      to: "scenario_intro",
      payload: { previousTrialIndex: trial.trial_index }
    });

      return {
        status: "active",
        currentTrialIndex: nextTrial.trial_index,
        currentState: "scenario_intro"
      };
    }
  );

  return transaction();
}

export function listAssignmentsAndSessions(): {
  assignments: Array<Record<string, unknown>>;
  sessions: Array<Record<string, unknown>>;
  cellCounts: Array<Record<string, unknown>>;
} {
  const assignments = db
    .prepare("SELECT * FROM assignments ORDER BY created_at DESC")
    .all() as Array<Record<string, unknown>>;

  const sessions = db
    .prepare(
      `
      SELECT s.*, tp.condition, tp.scenario_id
      FROM sessions s
      LEFT JOIN trial_plan tp ON tp.session_id = s.id AND tp.trial_index = s.current_trial_index
      ORDER BY s.created_at DESC
      `
    )
    .all() as Array<Record<string, unknown>>;

  const cellCounts = db
    .prepare("SELECT cell_id, COUNT(*) as count FROM assignments GROUP BY cell_id ORDER BY cell_id")
    .all() as Array<Record<string, unknown>>;

  return { assignments, sessions, cellCounts };
}

export function exportAllData(): Record<string, unknown> {
  const tableNames = [
    "assignments",
    "sessions",
    "trial_plan",
    "events",
    "ai_calls",
    "revisor_suggestions",
    "facilitator_reflections",
    "surveys"
  ];

  const output: Record<string, unknown> = {};
  for (const tableName of tableNames) {
    output[tableName] = db.prepare(`SELECT * FROM ${tableName}`).all();
  }

  return output;
}
