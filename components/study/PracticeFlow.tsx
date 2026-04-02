"use client";

import { SurveyQuestionField, type SurveyValue } from "@/components/surveys/SurveyQuestionField";
import { ConsentFormContent } from "@/components/study/ConsentFormContent";
import { StudyContactBar } from "@/components/study/StudyContactBar";
import type { AiLoadingCopy, PortalMode, StudyState, SurveyItem } from "@/components/study/types";

export function PracticeFlow({
  portalMode,
  participantAccessCode,
  sessionId,
  participantLabel,
  accessCode,
  currentState,
  busy,
  error,
  preSurveyItems,
  preSurveyAnswers,
  practiceSurveyItems,
  practiceSurveyAnswers,
  practiceText,
  practiceNudgeRequested,
  practiceNudge,
  aiLoadingCopy,
  isPracticeAiLoading,
  onPreSurveyChange,
  onPracticeSurveyChange,
  onPracticeTextChange,
  onSubmitPreSurvey,
  onStartPracticeTask,
  onContinueToPracticeSurvey,
  onRequestPracticeNudge,
  onSubmitPracticeRound,
  practiceWordCount
}: {
  portalMode: PortalMode;
  participantAccessCode?: string;
  sessionId: string;
  participantLabel: string;
  accessCode: string;
  currentState: StudyState;
  busy: boolean;
  error: string;
  preSurveyItems: SurveyItem[];
  preSurveyAnswers: Record<string, SurveyValue>;
  practiceSurveyItems: SurveyItem[];
  practiceSurveyAnswers: Record<string, SurveyValue>;
  practiceText: string;
  practiceNudgeRequested: boolean;
  practiceNudge: string | null;
  aiLoadingCopy: AiLoadingCopy | null;
  isPracticeAiLoading: boolean;
  onPreSurveyChange: (itemId: string, next: SurveyValue) => void;
  onPracticeSurveyChange: (itemId: string, next: SurveyValue) => void;
  onPracticeTextChange: (nextText: string) => void;
  onSubmitPreSurvey: () => void;
  onStartPracticeTask: () => void;
  onContinueToPracticeSurvey: () => void;
  onRequestPracticeNudge: () => void;
  onSubmitPracticeRound: () => void;
  practiceWordCount: number;
}) {
  const preSurveyBlockedForAiInexperience = preSurveyAnswers.pre_prior_ai_usage_frequency === 1;
  const preSurveyContinueTitle = preSurveyBlockedForAiInexperience
    ? "Participants who have never used AI writing tools are not eligible for this study."
    : "Continue to the practice round.";

  return (
    <div className="layout-grid">
      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            {portalMode === "participant" ? (
              <>
                <strong>Access Code:</strong> {participantAccessCode ?? accessCode}
              </>
            ) : (
              <>
                <strong>Session:</strong> {sessionId.slice(0, 8)} | <strong>Participant:</strong> {participantLabel} ({accessCode})
              </>
            )}
          </div>
          <div>
            {currentState === "pre_survey" ? (
              <span className="tag" title="Complete this short baseline survey before the practice round.">
                Pre-Survey
              </span>
            ) : null}{" "}
            <span className="tag" title="This short onboarding round is not part of the 3-condition comparison.">
              Practice Round
            </span>{" "}
            {portalMode === "researcher" ? <span className="tag">State: {currentState}</span> : null}
          </div>
        </div>
      </section>

      {currentState === "pre_survey" ? (
        <section className="card" style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ display: "grid", gap: "0.9rem" }}>
            <h1>Consent and Pre-Study Survey</h1>
            <div className="consent-modal-body">
              <ConsentFormContent />
            </div>
            <div style={{ display: "grid", gap: "0.8rem" }}>
              {preSurveyItems.map((item) => (
                <div key={item.id} style={{ display: "grid", gap: "0.45rem" }}>
                  {item.id === "pre_followup_interview" ? (
                    <p style={{ margin: 0, color: "black", fontSize: "0.95rem" }}>
                      If you choose to participate in the interview, we will send you a scheduling invitation for interview after completion.
                    </p>
                  ) : null}
                  <SurveyQuestionField
                    item={item}
                    value={preSurveyAnswers[item.id]}
                    disabled={busy}
                    onChange={(next) => onPreSurveyChange(item.id, next)}
                  />
                </div>
              ))}
            </div>
            <button
              className="primary"
              type="button"
              disabled={busy}
              title={preSurveyContinueTitle}
              style={preSurveyBlockedForAiInexperience ? { cursor: "not-allowed" } : undefined}
              onClick={onSubmitPreSurvey}
            >
              Continue to Practice
            </button>
          </div>
        </section>
      ) : null}

      {currentState === "practice_intro" ? (
        <div className="workspace-grid">
          <section className="card">
            <div style={{ display: "grid", gap: "0.9rem" }}>
              <h1 title="This round is only for learning the interface.">Practice Round</h1>
              <p style={{ color: "black" }}>
                Before the real study begins, complete this short practice round to get familiar with the interface including the AI
                side panel on the right.
              </p>
              <p style={{ color: "black" }}>The practice task is not part of the main analysis. It should take about two minutes.</p>
              <button
                className="primary"
                type="button"
                disabled={busy}
                title="Opens a simple warm-up writing task."
                onClick={onStartPracticeTask}
              >
                Start When Ready
              </button>
            </div>
          </section>
          <section className="card">
            <h2>AI Side Panel</h2>
            <p style={{ color: "var(--muted-foreground)" }}>The AI assistant will appear here once you start the practice task.</p>
          </section>
        </div>
      ) : null}

      {currentState === "practice_task" ? (
        <div className="workspace-grid">
          <section className="card">
            <div style={{ display: "grid", gap: "0.9rem" }}>
              <h1 title="This is a neutral warm-up prompt.">Practice Task</h1>
              <p style={{ color: "black" }}>
                A friend texts you: <strong>&quot;Hey, want to grab lunch tomorrow?&quot;</strong>
              </p>
              <p style={{ color: "black" }}>Write a short reply. This is just to get used to the editor and the AI side panel.</p>
              <textarea
                value={practiceText}
                onChange={(event) => onPracticeTextChange(event.target.value)}
                placeholder="Write a short reply here..."
                disabled={busy}
                style={{ minHeight: "180px" }}
                title="This practice editor is separate from the real study blocks."
              />
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <span className="tag" title="Practice word count is not used in the experimental timing analysis.">
                  Word Count: {practiceWordCount}
                </span>
              </div>
              <button
                className="primary"
                type="button"
                disabled={busy}
                title="Moves to the short practice feedback survey."
                onClick={onContinueToPracticeSurvey}
              >
                Continue to Practice Survey
              </button>
            </div>
          </section>
          <section className="card">
            <h2>AI Side Panel</h2>
            {!practiceNudgeRequested ? (
              <div style={{ display: "grid", gap: "0.7rem" }}>
                <p style={{ color: "black" }}>After writing your reply, click below to get a quick suggestion from the AI.</p>
                {isPracticeAiLoading && aiLoadingCopy ? (
                  <div className="ai-status-card" aria-live="polite" aria-busy="true">
                    <div className="ai-status-header">
                      <span className="ai-status-dot" />
                      <span>{aiLoadingCopy.eyebrow}</span>
                    </div>
                    <p className="ai-status-title">{aiLoadingCopy.title}</p>
                    <p className="ai-status-detail">{aiLoadingCopy.detail}</p>
                    <div className="ai-status-bars" aria-hidden="true">
                      <span className="ai-status-bar ai-status-bar-short" />
                      <span className="ai-status-bar ai-status-bar-medium" />
                      <span className="ai-status-bar ai-status-bar-long" />
                    </div>
                  </div>
                ) : null}
                <button
                  className="primary"
                  type="button"
                  disabled={busy || !practiceText.trim()}
                  title="Get a single casual suggestion for your reply."
                  onClick={onRequestPracticeNudge}
                >
                  {busy ? "Getting suggestion…" : "Get AI Suggestion"}
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "0.7rem" }}>
                <div className="card" style={{ background: "var(--muted)" }}>
                  <p>
                    <strong>AI suggestion:</strong>
                  </p>
                  <p style={{ marginTop: "0.3rem" }}>{practiceNudge}</p>
                </div>
                <p style={{ color: "var(--muted-foreground)", fontSize: "0.88em" }}>
                  You can edit your reply based on this suggestion, or continue as-is.
                </p>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {currentState === "practice_survey" ? (
        <section className="card" style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ display: "grid", gap: "0.9rem" }}>
            <h1 title="This quick survey checks whether the interface feels clear before the real study starts.">Practice Survey</h1>
            <p style={{ color: "black" }}>
              This short feedback round helps confirm you are comfortable with the interface before the timed study conditions begin.
            </p>
            <div style={{ display: "grid", gap: "0.8rem" }}>
              {practiceSurveyItems.map((item) => (
                <SurveyQuestionField
                  key={item.id}
                  item={item}
                  value={practiceSurveyAnswers[item.id]}
                  disabled={busy}
                  onChange={(next) => onPracticeSurveyChange(item.id, next)}
                />
              ))}
            </div>
            <button
              className="primary"
              type="button"
              disabled={busy}
              title="Completes practice and opens the first experimental block."
              onClick={onSubmitPracticeRound}
            >
              Begin Study
            </button>
          </div>
        </section>
      ) : null}

      {error ? <p style={{ color: "var(--warn)", padding: "0 1rem" }}>{error}</p> : null}
      {portalMode === "participant" ? <StudyContactBar /> : null}
    </div>
  );
}
