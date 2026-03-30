import { toCsv } from "@/lib/csv";
import { listAssignmentsAndSessions } from "@/lib/sessionManager";
import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  const snapshot = listAssignmentsAndSessions();

  const rows = snapshot.cells.flatMap((cell) =>
    cell.participants.map((participant) => ({
      participant_id: participant.participantId,
      participant_label: participant.participantLabel,
      access_code: participant.accessCode,
      cell_id: cell.cellId,
      trial_sequence: cell.trialSpecs
        .map((trial) => `${trial.condition}:${trial.scenarioId}`)
        .join(" | "),
      session_id: participant.sessionId,
      session_status: participant.sessionStatus,
      current_state: participant.currentState,
      current_trial_index: participant.currentTrialIndex,
      completed_trials: participant.completedTrials,
      total_trials: participant.totalTrials
    }))
  );

  const csv = toCsv(rows, [
    "participant_id",
    "participant_label",
    "access_code",
    "cell_id",
    "trial_sequence",
    "session_id",
    "session_status",
    "current_state",
    "current_trial_index",
    "completed_trials",
    "total_trials"
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=participants_${new Date().toISOString().slice(0, 10)}.csv`
    }
  });
}
