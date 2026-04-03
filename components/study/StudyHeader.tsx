"use client";

import type { PortalMode, SessionPayload, StudyState } from "@/components/study/types";
import { getScenarioLabel } from "@/components/study/utils";

export function StudyHeader({
  portalMode,
  snapshot,
  currentState
}: {
  portalMode: PortalMode;
  snapshot: SessionPayload;
  currentState: StudyState;
}) {
  return (
    <section className="card" style={{ padding: "0.6rem 1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          {portalMode === "participant" ? (
            <div style={{ display: "grid", gap: "0.15rem" }}>
              <div>
                <strong>Resume later:</strong> Enter your email on the study access page.
              </div>
              <span className="text-muted">Use the same email address you entered in the pre-study survey.</span>
            </div>
          ) : (
            <>
              <strong>Session:</strong> {snapshot.session.id.slice(0, 8)} | <strong>Participant:</strong>{" "}
              {snapshot.session.participantLabel} ({snapshot.session.accessCode})
            </>
          )}
        </div>
        <div>
          <span className="tag" title="Only the 3 experimental blocks count toward the main comparison.">
            Block {snapshot.currentTrial.order_position} of {snapshot.allTrials.length}
          </span>{" "}
          {portalMode === "researcher" ? (
            <>
              <span className="tag">Condition: {snapshot.currentTrial.condition}</span>{" "}
              <span className="tag">Scenario: {getScenarioLabel(snapshot.currentTrial.scenario_id)}</span>{" "}
              <span className="tag">State: {currentState}</span>
            </>
          ) : null}
        </div>
      </div>
      <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
        {snapshot.allTrials.map((trial) => (
          <span key={trial.trial_index} className="tag">
            {portalMode === "participant"
              ? `Block ${trial.order_position} — ${trial.status}`
              : `T${trial.trial_index + 1} ${trial.condition}/${trial.scenario_id}/${trial.status}`}
          </span>
        ))}
      </div>
    </section>
  );
}
