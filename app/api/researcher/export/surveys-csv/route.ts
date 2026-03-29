import { toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

type SurveyExportRow = {
  survey_type: "per_condition" | "post_study";
  session_id: string;
  participant_id: string;
  participant_label: string;
  access_code: string;
  trial_index: number | null;
  condition: string | null;
  scenario_id: string | null;
  responses_json: string;
  created_at: string;
};

export async function GET(): Promise<NextResponse> {
  const perConditionRows = db
    .prepare(
      `
      SELECT
        'per_condition' AS survey_type,
        sv.session_id,
        p.id AS participant_id,
        p.participant_label,
        p.access_code,
        sv.trial_index,
        tp.condition,
        tp.scenario_id,
        sv.responses_json,
        sv.created_at
      FROM surveys sv
      JOIN sessions s ON s.id = sv.session_id
      JOIN participants p ON p.id = s.participant_id
      LEFT JOIN trial_plan tp ON tp.session_id = sv.session_id AND tp.trial_index = sv.trial_index
      WHERE s.is_playground = 0
      ORDER BY sv.created_at ASC
      `
    )
    .all() as SurveyExportRow[];

  const postStudyRows = db
    .prepare(
      `
      SELECT
        'post_study' AS survey_type,
        ps.session_id,
        p.id AS participant_id,
        p.participant_label,
        p.access_code,
        NULL AS trial_index,
        NULL AS condition,
        NULL AS scenario_id,
        ps.responses_json,
        ps.created_at
      FROM post_study_surveys ps
      JOIN sessions s ON s.id = ps.session_id
      JOIN participants p ON p.id = s.participant_id
      WHERE s.is_playground = 0
      ORDER BY ps.created_at ASC
      `
    )
    .all() as SurveyExportRow[];

  const rows = [...perConditionRows, ...postStudyRows].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );

  const csv = toCsv(rows, [
    "survey_type",
    "session_id",
    "participant_id",
    "participant_label",
    "access_code",
    "trial_index",
    "condition",
    "scenario_id",
    "responses_json",
    "created_at"
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=surveys_${new Date().toISOString().slice(0, 10)}.csv`
    }
  });
}
