"use client";

import { SurveyQuestionField, type SurveyValue } from "@/components/surveys/SurveyQuestionField";
import type { SurveyItem, SurveyTemplate } from "@/components/study/types";
import type { RefObject } from "react";

export function ConditionSurveySection({
  surveyRef,
  template,
  items,
  answers,
  busy,
  error,
  onChange,
  onSubmit
}: {
  surveyRef: RefObject<HTMLElement | null>;
  template: SurveyTemplate;
  items: SurveyItem[];
  answers: Record<string, SurveyValue>;
  busy: boolean;
  error: string;
  onChange: (itemId: string, next: SurveyValue) => void;
  onSubmit: () => void;
}) {
  return (
    <section ref={surveyRef} className="card">
      <h3>{template.title}</h3>
      <p style={{ color: "black" }}>{template.intro}</p>
      <div style={{ display: "grid", gap: "0.8rem", marginTop: "0.8rem" }}>
        {items.map((item) => (
          <SurveyQuestionField
            key={item.id}
            item={item}
            value={answers[item.id]}
            disabled={busy}
            onChange={(next) => onChange(item.id, next)}
          />
        ))}
      </div>
      <div style={{ marginTop: "1rem" }}>
        <button
          className="primary"
          type="button"
          disabled={busy}
          title="Submits the current block and advances to the next step."
          onClick={onSubmit}
        >
          Submit Condition + Continue
        </button>
      </div>
      {error ? <p style={{ color: "var(--destructive)", marginTop: "0.5rem" }}>{error}</p> : null}
    </section>
  );
}
