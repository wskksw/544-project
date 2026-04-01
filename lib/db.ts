import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "aimc.sqlite");
const SCHEMA_VERSION = 3;

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath, { timeout: 10000 });
db.pragma("busy_timeout = 10000");
db.pragma("foreign_keys = ON");

function tableExists(tableName: string): boolean {
  const row = db
    .prepare("SELECT 1 as ok FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { ok: number } | undefined;
  return Boolean(row?.ok);
}

function recreateSchema(): void {
  db.exec(`
DROP TABLE IF EXISTS post_study_surveys;
DROP TABLE IF EXISTS surveys;
DROP TABLE IF EXISTS trial_metrics;
DROP TABLE IF EXISTS thought_partner_reflections;
DROP TABLE IF EXISTS editor_suggestions;
DROP TABLE IF EXISTS ai_calls;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS trial_plan;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS assignments;
DROP TABLE IF EXISTS participants;
DROP TABLE IF EXISTS pre_study_surveys;
DROP TABLE IF EXISTS survey_templates;
`);

  db.exec(`
CREATE TABLE participants (
  id TEXT PRIMARY KEY,
  participant_label TEXT NOT NULL,
  access_code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE assignments (
  participant_id TEXT PRIMARY KEY,
  cell_id TEXT NOT NULL,
  target_n INTEGER NOT NULL,
  assigned_manually INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY(participant_id) REFERENCES participants(id) ON DELETE CASCADE
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL,
  is_playground INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  current_trial_index INTEGER NOT NULL DEFAULT 0,
  current_state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(participant_id) REFERENCES participants(id) ON DELETE CASCADE
);

CREATE TABLE trial_plan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  trial_index INTEGER NOT NULL,
  scenario_id TEXT NOT NULL,
  condition TEXT NOT NULL,
  order_position INTEGER NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  final_message_text TEXT,
  UNIQUE(session_id, trial_index),
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  trial_index INTEGER,
  event_type TEXT NOT NULL,
  state_from TEXT,
  state_to TEXT,
  created_at TEXT NOT NULL,
  payload_json TEXT,
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE ai_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  trial_index INTEGER NOT NULL,
  condition TEXT NOT NULL,
  stage TEXT NOT NULL,
  request_json TEXT NOT NULL,
  response_json TEXT NOT NULL,
  validated_json TEXT,
  is_valid INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE editor_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_call_id INTEGER NOT NULL,
  segment_original TEXT NOT NULL,
  suggested_change TEXT NOT NULL,
  category TEXT NOT NULL,
  reason_text TEXT NOT NULL,
  action_status TEXT NOT NULL,
  user_modified_text TEXT,
  FOREIGN KEY(ai_call_id) REFERENCES ai_calls(id) ON DELETE CASCADE
);

CREATE TABLE thought_partner_reflections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  trial_index INTEGER NOT NULL,
  question_order INTEGER NOT NULL,
  question TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE pre_study_surveys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE,
  responses_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE surveys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  trial_index INTEGER NOT NULL,
  responses_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE post_study_surveys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE,
  responses_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE survey_templates (
  template_id TEXT PRIMARY KEY,
  template_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE trial_metrics (
  session_id TEXT NOT NULL,
  trial_index INTEGER NOT NULL,
  condition TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  completion_time_sec INTEGER NOT NULL,
  word_count INTEGER NOT NULL,
  keystroke_count INTEGER NOT NULL,
  self_authored_text_ratio REAL,
  suggestion_acceptance_rate REAL,
  ghost_writer_edit_count INTEGER,
  reflection_duration_sec INTEGER,
  created_at TEXT NOT NULL,
  PRIMARY KEY (session_id, trial_index),
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
`);

  db.pragma(`user_version = ${SCHEMA_VERSION}`);
}

function ensureIncrementalTables(): void {
  db.exec(`
CREATE TABLE IF NOT EXISTS pre_study_surveys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE,
  responses_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
`);
}

const currentVersion = db.pragma("user_version", { simple: true }) as number;
const requiredTables = [
  "participants",
  "assignments",
  "sessions",
  "trial_plan",
  "events",
  "ai_calls",
  "editor_suggestions",
  "thought_partner_reflections",
  "surveys",
  "post_study_surveys",
  "survey_templates",
  "trial_metrics"
];
const hasAllRequiredTables = requiredTables.every((table) => tableExists(table));

if (currentVersion !== SCHEMA_VERSION || !hasAllRequiredTables) {
  recreateSchema();
}

ensureIncrementalTables();

export { db };
