import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "aimc.sqlite");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath, { timeout: 10000 });
db.pragma("busy_timeout = 10000");

db.exec(`
CREATE TABLE IF NOT EXISTS assignments (
  participant_id TEXT PRIMARY KEY,
  cell_id TEXT NOT NULL,
  scenario_first TEXT NOT NULL,
  pattern_id TEXT NOT NULL,
  target_n INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL,
  is_playground INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  current_trial_index INTEGER NOT NULL DEFAULT 0,
  current_state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trial_plan (
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
  UNIQUE(session_id, trial_index)
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  trial_index INTEGER,
  event_type TEXT NOT NULL,
  state_from TEXT,
  state_to TEXT,
  created_at TEXT NOT NULL,
  payload_json TEXT
);

CREATE TABLE IF NOT EXISTS ai_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  trial_index INTEGER NOT NULL,
  condition TEXT NOT NULL,
  stage TEXT NOT NULL,
  request_json TEXT NOT NULL,
  response_json TEXT NOT NULL,
  validated_json TEXT,
  is_valid INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS revisor_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_call_id INTEGER NOT NULL,
  segment_original TEXT NOT NULL,
  suggested_change TEXT NOT NULL,
  reason_tag TEXT NOT NULL,
  action_status TEXT NOT NULL,
  user_modified_text TEXT,
  FOREIGN KEY(ai_call_id) REFERENCES ai_calls(id)
);

CREATE TABLE IF NOT EXISTS facilitator_reflections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  trial_index INTEGER NOT NULL,
  question TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS surveys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  trial_index INTEGER NOT NULL,
  responses_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);

export { db };
