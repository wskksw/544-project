import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ItemShape = {
  id: string;
  prompt: string;
  type: "likert" | "open_text" | "multiple_choice";
  required: boolean;
  scaleMin?: number;
  scaleMax?: number;
  options?: string[];
};

export type SurveyValue = string | number;

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

  const min = item.scaleMin ?? 1;
  const max = item.scaleMax ?? 7;

  return (
    <Label key={item.id}>
      {label}
      <Select
        value={typeof value === "number" ? String(value) : ""}
        onChange={(event) => onChange(Number(event.target.value))}
        disabled={disabled}
      >
        <option value="">Select</option>
        {Array.from({ length: max - min + 1 }, (_unused, index) => min + index).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    </Label>
  );
}
