"use client";

import { SurveyQuestionField, type SurveyValue } from "@/components/surveys/SurveyQuestionField";
import type { SurveyItem, SurveyTemplate } from "@/components/study/types";

export function PostStudySurveySection({
  template,
  items,
  answers,
  busy,
  error,
  onChange,
  onSubmit
}: {
  template: SurveyTemplate;
  items: SurveyItem[];
  answers: Record<string, SurveyValue>;
  busy: boolean;
  error: string;
  onChange: (itemId: string, next: SurveyValue) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="card" style={{ maxWidth: 860, margin: "0 auto" }}>
      <h1>{template.title}</h1>
      <p style={{ color: "black" }}>{template.intro}</p>
      <p style={{ color: "black" }}>All condition blocks are complete. Submit this final survey to finish the study.</p>

      <div style={{ display: "grid", gap: "0.8rem" }}>
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

      <div style={{ marginTop: "1rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <button className="primary" type="button" disabled={busy} onClick={onSubmit}>
          Submit Final Survey
        </button>
      </div>

      {error ? <p style={{ color: "var(--warn)" }}>{error}</p> : null}
    </div>
  );
}
