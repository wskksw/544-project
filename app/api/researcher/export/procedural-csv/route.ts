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
  suggestion_total_count: number;
  suggestion_accept_count: number;
  suggestion_modify_count: number;
  suggestion_reject_count: number;
  suggestion_applied_count: number;
  suggestion_acceptance_rate: number | null;
  suggestion_modify_rate: number | null;
  suggestion_applied_rate: number | null;
  ghost_writer_edit_count: number | null;
  reflection_duration_sec: number | null;
  pre_editor_message_text: string | null;
  final_message_text: string | null;
  created_at: string;
};

type ProceduralAiCallRow = {
  session_id: string;
  trial_index: number;
  condition: string;
  stage: string;
  validated_json: string | null;
  created_at: string;
};

type ProceduralReflectionRow = {
  session_id: string;
  trial_index: number;
  question_order: number;
  question: string;
  response: string;
};

function safeJsonParse(raw: string | null): unknown {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function trialKey(sessionId: string, trialIndex: number): string {
  return `${sessionId}:${trialIndex}`;
}

export async function GET(): Promise<NextResponse> {
  const metricRows = db
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
        COALESCE(suggestion_summary.suggestion_total_count, 0) AS suggestion_total_count,
        COALESCE(suggestion_summary.suggestion_accept_count, 0) AS suggestion_accept_count,
        COALESCE(suggestion_summary.suggestion_modify_count, 0) AS suggestion_modify_count,
        COALESCE(suggestion_summary.suggestion_reject_count, 0) AS suggestion_reject_count,
        COALESCE(suggestion_summary.suggestion_applied_count, 0) AS suggestion_applied_count,
        tm.suggestion_acceptance_rate,
        CASE
          WHEN COALESCE(suggestion_summary.suggestion_total_count, 0) > 0
            THEN CAST(suggestion_summary.suggestion_modify_count AS REAL) / suggestion_summary.suggestion_total_count
          ELSE NULL
        END AS suggestion_modify_rate,
        CASE
          WHEN COALESCE(suggestion_summary.suggestion_total_count, 0) > 0
            THEN CAST(suggestion_summary.suggestion_applied_count AS REAL) / suggestion_summary.suggestion_total_count
          ELSE NULL
        END AS suggestion_applied_rate,
        tm.ghost_writer_edit_count,
        tm.reflection_duration_sec,
        tp.pre_editor_message_text,
        tp.final_message_text,
        tm.created_at
      FROM trial_metrics tm
      JOIN sessions s ON s.id = tm.session_id
      JOIN participants p ON p.id = s.participant_id
      LEFT JOIN assignments a ON a.participant_id = p.id
      LEFT JOIN trial_plan tp ON tp.session_id = tm.session_id AND tp.trial_index = tm.trial_index
      LEFT JOIN (
        SELECT
          ac.session_id,
          ac.trial_index,
          COUNT(es.id) AS suggestion_total_count,
          SUM(CASE WHEN es.action_status = 'accept' THEN 1 ELSE 0 END) AS suggestion_accept_count,
          SUM(CASE WHEN es.action_status = 'modify' THEN 1 ELSE 0 END) AS suggestion_modify_count,
          SUM(CASE WHEN es.action_status = 'reject' THEN 1 ELSE 0 END) AS suggestion_reject_count,
          SUM(CASE WHEN es.action_status IN ('accept', 'modify') THEN 1 ELSE 0 END) AS suggestion_applied_count
        FROM editor_suggestions es
        JOIN ai_calls ac ON ac.id = es.ai_call_id
        GROUP BY ac.session_id, ac.trial_index
      ) suggestion_summary ON suggestion_summary.session_id = tm.session_id AND suggestion_summary.trial_index = tm.trial_index
      WHERE s.is_playground = 0
      ORDER BY p.participant_label ASC, tm.trial_index ASC
      `
    )
    .all() as ProceduralExportRow[];

  const aiCalls = db
    .prepare(
      `
      SELECT
        ac.session_id,
        ac.trial_index,
        ac.condition,
        ac.stage,
        ac.validated_json,
        ac.created_at
      FROM ai_calls ac
      JOIN sessions s ON s.id = ac.session_id
      WHERE s.is_playground = 0
      ORDER BY ac.created_at ASC, ac.id ASC
      `
    )
    .all() as ProceduralAiCallRow[];

  const reflections = db
    .prepare(
      `
      SELECT
        tpr.session_id,
        tpr.trial_index,
        tpr.question_order,
        tpr.question,
        tpr.response
      FROM thought_partner_reflections tpr
      JOIN sessions s ON s.id = tpr.session_id
      WHERE s.is_playground = 0
      ORDER BY tpr.session_id ASC, tpr.trial_index ASC, tpr.question_order ASC, tpr.id ASC
      `
    )
    .all() as ProceduralReflectionRow[];

  const ghostWriterDraftByTrial = new Map<string, string>();
  const thoughtPartnerQuestionsByTrial = new Map<string, unknown>();

  for (const aiCall of aiCalls) {
    const key = trialKey(aiCall.session_id, aiCall.trial_index);
    const parsed = safeJsonParse(aiCall.validated_json);

    if (aiCall.condition === "ghost_writer" && aiCall.stage === "ai_generation") {
      const draft =
        parsed && typeof parsed === "object" && "draft" in parsed && typeof parsed.draft === "string"
          ? parsed.draft
          : null;
      if (draft) {
        ghostWriterDraftByTrial.set(key, draft);
      }
      continue;
    }

    if (aiCall.condition === "thought_partner" && aiCall.stage === "questions" && Array.isArray(parsed)) {
      thoughtPartnerQuestionsByTrial.set(key, parsed);
    }
  }

  const thoughtPartnerResponsesByTrial = new Map<
    string,
    Array<{ question_order: number; question: string; response: string }>
  >();

  for (const reflection of reflections) {
    const key = trialKey(reflection.session_id, reflection.trial_index);
    const current = thoughtPartnerResponsesByTrial.get(key) ?? [];
    current.push({
      question_order: reflection.question_order,
      question: reflection.question,
      response: reflection.response
    });
    thoughtPartnerResponsesByTrial.set(key, current);
  }

  const rows = metricRows.map((row) => {
    const key = trialKey(row.session_id, row.trial_index);
    const condition = row.condition;

    return {
      ...row,
      editor_pre_message_text: condition === "editor" ? row.pre_editor_message_text : null,
      editor_post_message_text: condition === "editor" ? row.final_message_text : null,
      ghost_writer_ai_draft_text:
        condition === "ghost_writer" ? ghostWriterDraftByTrial.get(key) ?? row.pre_editor_message_text : null,
      ghost_writer_post_message_text: condition === "ghost_writer" ? row.final_message_text : null,
      thought_partner_ai_questions_json:
        condition === "thought_partner" ? thoughtPartnerQuestionsByTrial.get(key) ?? null : null,
      thought_partner_human_responses_json:
        condition === "thought_partner" ? thoughtPartnerResponsesByTrial.get(key) ?? null : null,
      thought_partner_post_message_text: condition === "thought_partner" ? row.final_message_text : null
    };
  });

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
    "suggestion_total_count",
    "suggestion_accept_count",
    "suggestion_modify_count",
    "suggestion_reject_count",
    "suggestion_applied_count",
    "suggestion_acceptance_rate",
    "suggestion_modify_rate",
    "suggestion_applied_rate",
    "ghost_writer_edit_count",
    "reflection_duration_sec",
    "editor_pre_message_text",
    "editor_post_message_text",
    "ghost_writer_ai_draft_text",
    "ghost_writer_post_message_text",
    "thought_partner_ai_questions_json",
    "thought_partner_human_responses_json",
    "thought_partner_post_message_text",
    "created_at"
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=procedural_${new Date().toISOString().slice(0, 10)}.csv`
    }
  });
}
