import { getScenarioById } from "@/lib/scenarios";
import { getCompletionCode, getSessionSnapshot } from "@/lib/sessionManager";
import { getSurveyTemplate } from "@/lib/surveys";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse> {
  try {
    const { sessionId } = await context.params;
    const snapshot = getSessionSnapshot(sessionId);
    const scenario = getScenarioById(snapshot.currentTrial.scenario_id);

    return NextResponse.json({
      session: {
        id: snapshot.session.id,
        participantId: snapshot.session.participant_id,
        participantLabel: snapshot.session.participant_label,
        accessCode: snapshot.session.access_code,
        isPlayground: Boolean(snapshot.session.is_playground),
        status: snapshot.session.status,
        currentTrialIndex: snapshot.session.current_trial_index,
        currentState: snapshot.session.current_state
      },
      currentTrial: {
        ...snapshot.currentTrial,
        scenario
      },
      allTrials: snapshot.allTrials,
      conditionSurveyTemplate: getSurveyTemplate("per_condition"),
      postStudySurveyTemplate: getSurveyTemplate("post_study"),
      completionCode: getCompletionCode(snapshot.session.id)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
