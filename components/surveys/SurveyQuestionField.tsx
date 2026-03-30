import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ItemShape = {
  id: string;
  prompt: string;
  type: "likert" | "open_text" | "multiple_choice" | "ranking";
  required: boolean;
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: string[];
  options?: string[];
};

export type SurveyValue = string | number | string[];

const DEFAULT_7_POINT_LABELS = [
  "Strongly disagree",
  "Disagree",
  "Somewhat disagree",
  "Neutral",
  "Somewhat agree",
  "Agree",
  "Strongly agree"
];

function likertLabels(item: ItemShape, min: number, max: number): string[] {
  const pointCount = max - min + 1;
  if (item.scaleLabels && item.scaleLabels.length === pointCount) {
    return item.scaleLabels;
  }

  if (min === 1 && max === 7) {
    return DEFAULT_7_POINT_LABELS;
  }

  return Array.from({ length: pointCount }, (_unused, index) => String(min + index));
}

export function SurveyQuestionField({
  item,
  value,
  disabled,
  onChange
}: {
  item: ItemShape;
  value: SurveyValue | undefined;
  disabled: boolean;
  onChange: (next: SurveyValue) => void;
}) {
  const label = `${item.prompt}${item.required ? " *" : ""}`;

  if (item.type === "open_text") {
    return (
      <Label key={item.id}>
        {label}
        <Textarea
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        />
      </Label>
    );
  }

  if (item.type === "multiple_choice") {
    return (
      <Label key={item.id}>
        {label}
        <Select
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        >
          <option value="">Select</option>
          {(item.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </Label>
    );
  }

  if (item.type === "ranking") {
    const currentRanking = Array.isArray(value) ? value : [];
    const options = item.options ?? [];

    return (
      <Label key={item.id}>
        {label}
        <div style={{ display: "grid", gap: "0.55rem" }}>
          {options.map((_option, index) => {
            const usedOptions = currentRanking.filter((_item, usedIndex) => usedIndex !== index);
            return (
              <Label key={`${item.id}_rank_${index}`}>
                Rank {index + 1}
                <Select
                  value={currentRanking[index] ?? ""}
                  onChange={(event) => {
                    const nextRanking = [...currentRanking];
                    nextRanking[index] = event.target.value;
                    onChange(nextRanking);
                  }}
                  disabled={disabled}
                >
                  <option value="">Select</option>
                  {options.map((option) => (
                    <option
                      key={`${item.id}_${option}`}
                      value={option}
                      disabled={usedOptions.includes(option)}
                    >
                      {option}
                    </option>
                  ))}
                </Select>
              </Label>
            );
          })}
        </div>
      </Label>
    );
  }

  const min = item.scaleMin ?? 1;
  const max = item.scaleMax ?? 7;
  const labels = likertLabels(item, min, max);
  const optionValues = Array.from({ length: max - min + 1 }, (_unused, index) => min + index);

  return (
    <fieldset className="survey-likert" disabled={disabled} style={{ margin: 0, padding: 0, border: "none" }}>
      <legend className="survey-question-label">{label}</legend>
      <div className="survey-likert-grid" role="radiogroup" aria-label={item.prompt}>
        {optionValues.map((option, index) => {
          const selected = value === option;
          return (
            <label
              key={`${item.id}_${option}`}
              className={`survey-likert-option${selected ? " survey-likert-option-selected" : ""}${
                disabled ? " survey-likert-option-disabled" : ""
              }`}
            >
              <input
                type="radio"
                name={item.id}
                value={option}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(option)}
                className="survey-likert-input"
              />
              <span className="survey-likert-marker" aria-hidden="true">
                <span className="survey-likert-dot" />
              </span>
              <span className="survey-likert-caption">{labels[index]}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
