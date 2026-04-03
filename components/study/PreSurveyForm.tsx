"use client";

import { SurveyQuestionField, type SurveyValue } from "@/components/surveys/SurveyQuestionField";
import { ConsentFormContent } from "@/components/study/ConsentFormContent";
import { CONSENT_OPTION_NO } from "@/components/study/consent";
import type { SurveyItem } from "@/components/study/types";

export function PreSurveyForm({
  items,
  answers,
  busy,
  isInterviewSelected,
  when2MeetUrl,
  interviewAvailabilityConfirmed,
  onAnswerChange,
  onInterviewAvailabilityConfirmedChange,
  onSubmit,
  submitLabel,
  submitTitle,
  disableSubmit
}: {
  items: SurveyItem[];
  answers: Record<string, SurveyValue>;
  busy: boolean;
  isInterviewSelected: boolean;
  when2MeetUrl: string;
  interviewAvailabilityConfirmed: boolean;
  onAnswerChange: (itemId: string, next: SurveyValue) => void;
  onInterviewAvailabilityConfirmedChange: (next: boolean) => void;
  onSubmit: () => void;
  submitLabel: string;
  submitTitle: string;
  disableSubmit: boolean;
}) {
  const consentItem = items.find((item) => item.id === "pre_consent");
  const remainingItems = items.filter((item) => item.id !== "pre_consent");
  const preSurveyBlockedForMissingConsent = answers.pre_consent === CONSENT_OPTION_NO;

  return (
    <div style={{ display: "grid", gap: "0.9rem" }}>
      <h1>Pre-Study Survey</h1>
      <div style={{ display: "grid", gap: "1.15rem" }}>
        {consentItem ? (
          <section className="consent-inline-shell">
            <div className="consent-inline-header">
              <h2>Consent Form</h2>
              <p>Read the consent form below, then record your decision before completing the rest of the survey.</p>
            </div>
            <ConsentFormContent />
            <div style={{ display: "grid", gap: "0.6rem" }}>
              <SurveyQuestionField
                item={consentItem}
                value={answers[consentItem.id]}
                disabled={busy}
                onChange={(next) => onAnswerChange(consentItem.id, next)}
              />
              {preSurveyBlockedForMissingConsent ? (
                <p className="text-warning">You cannot continue to the practice round unless you consent to participate.</p>
              ) : null}
            </div>
          </section>
        ) : null}

        {remainingItems.map((item) => (
          <div key={item.id} style={{ display: "grid", gap: "0.55rem" }}>
            {item.id === "pre_writing_confidence" ? (
              <p style={{ margin: 0, color: "black", fontSize: "0.95rem" }}>
                For this question, please indicate how much you agree with the statement.
              </p>
            ) : null}
            {item.id === "pre_followup_interview" ? (
              <p style={{ margin: 0, color: "black", fontSize: "0.95rem" }}>
                If you choose Yes, you will add your availability now and then continue with the researcher-led interview flow.
              </p>
            ) : null}
            <SurveyQuestionField
              item={item}
              value={answers[item.id]}
              disabled={busy}
              onChange={(next) => onAnswerChange(item.id, next)}
            />
          </div>
        ))}

        {isInterviewSelected ? (
          <div
            style={{
              display: "grid",
              gap: "0.8rem",
              padding: "1rem",
              borderRadius: "0.85rem",
              background: "var(--muted)"
            }}
          >
            <div style={{ display: "grid", gap: "0.45rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Interview scheduling</h2>
              <p style={{ margin: 0, color: "black" }}>
                Please add every time slot that works for you before you continue. After that, the next page will give you the
                researcher-led session instructions.
              </p>
            </div>
            <div>
              <a href={when2MeetUrl} target="_blank" rel="noreferrer">
                Open When2Meet
              </a>
            </div>
            <label style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", color: "black" }}>
              <input
                type="checkbox"
                checked={interviewAvailabilityConfirmed}
                disabled={busy}
                onChange={(event) => onInterviewAvailabilityConfirmedChange(event.target.checked)}
              />
              <span>I added my availability on When2Meet.</span>
            </label>
          </div>
        ) : null}
      </div>

      <button
        className="primary"
        type="button"
        disabled={busy || disableSubmit}
        title={submitTitle}
        style={disableSubmit ? { cursor: "not-allowed" } : undefined}
        onClick={onSubmit}
      >
        {submitLabel}
      </button>
    </div>
  );
}
