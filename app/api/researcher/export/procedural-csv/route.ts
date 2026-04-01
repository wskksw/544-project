import { toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

type ProceduralExportRow = {
  participant_id: string;
  participant_label: string;
  access_code: string;
  cell_id: string | null;
  session_id: string;
  trial_index: number;
  order_position: number | null;
  condition: string;
  scenario_id: string;
  session_status: string;
  trial_status: string | null;
  completion_time_sec: number;
  word_count: number;
  keystroke_count: number;
  self_authored_text_ratio: number | null;
  suggestion_acceptance_rate: number | null;
  ghost_writer_edit_count: number | null;
  reflection_duration_sec: number | null;
  created_at: string;
};

export async function GET(): Promise<NextResponse> {
  const rows = db
    .prepare(
      `
      SELECT
        p.id AS participant_id,
        p.participant_label,
        p.access_code,
        a.cell_id,
        tm.session_id,
        tm.trial_index,
        tp.order_position,
        tm.condition,
        tm.scenario_id,
        s.status AS session_status,
        tp.status AS trial_status,
        tm.completion_time_sec,
        tm.word_count,
        tm.keystroke_count,
        tm.self_authored_text_ratio,
        tm.suggestion_acceptance_rate,
        tm.ghost_writer_edit_count,
        tm.reflection_duration_sec,
        tm.created_at
      FROM trial_metrics tm
      JOIN sessions s ON s.id = tm.session_id
      JOIN participants p ON p.id = s.participant_id
      LEFT JOIN assignments a ON a.participant_id = p.id
      LEFT JOIN trial_plan tp ON tp.session_id = tm.session_id AND tp.trial_index = tm.trial_index
      WHERE s.is_playground = 0
      ORDER BY p.participant_label ASC, tm.trial_index ASC
      `
    )
    .all() as ProceduralExportRow[];

  const csv = toCsv(rows, [
    "participant_id",
    "participant_label",
    "access_code",
    "cell_id",
    "session_id",
    "trial_index",
    "order_position",
    "condition",
    "scenario_id",
    "session_status",
    "trial_status",
    "completion_time_sec",
    "word_count",
    "keystroke_count",
    "self_authored_text_ratio",
    "suggestion_acceptance_rate",
    "ghost_writer_edit_count",
    "reflection_duration_sec",
    "created_at"
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=procedural_${new Date().toISOString().slice(0, 10)}.csv`
    }
  });
}