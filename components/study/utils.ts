import { visibleSurveyItems as filterVisibleSurveyItems } from "@/lib/surveyItems";
import { getConditionDisplayLabel } from "@/lib/conditionLabels";
import type { SurveyValue } from "@/components/surveys/SurveyQuestionField";
import type {
  BulletInputGuidance,
  Condition,
  EditorHighlightRange,
  HighlightStatus,
  StudyState,
  SurveyItem,
  SurveyTemplate
} from "@/components/study/types";

export function getScenarioLabel(scenarioId: string): string {
  switch (scenarioId) {
    case "scenario_a":
      return "A";
    case "scenario_b":
      return "B";
    case "scenario_c":
      return "C";
    default:
      return scenarioId;
  }
}

export function getPromptText(condition: Condition, state: StudyState): string {
  const conditionLabel = getConditionDisplayLabel(condition);

  if (state === "practice_intro") {
    return "Complete the short practice round to get familiar with the interface.";
  }
  if (state === "practice_task") {
    return "Write a reply, then try the AI suggestion on the right.";
  }
  if (state === "practice_survey") {
    return "This practice feedback will not be included in the main 3-condition comparison.";
  }

  const prompts: Record<Condition, Partial<Record<StudyState, string>>> = {
    ghost_writer: {
      scenario_intro: "Read the scenario, then click 'Start When Ready' to begin writing.",
      bullet_input:
        "Write 3-5 bullet points to brief the AI on the **situation** and **what you'd like the message to accomplish**.",
      ai_generation: `Generate a single ${conditionLabel} draft from the participant bullets only.`,
      final_edit: "Edit the generated draft freely, then continue to the survey."
    },
    editor: {
      scenario_intro: "Read the scenario, then click 'Start When Ready' to begin writing.",
      human_drafting:
        "Write a complete first draft - say everything you want to say in your own words. Don't worry about getting the wording perfect; the AI will suggest ways to improve it afterward. You control the final wording and can keep your original text.",
      ai_revision: "Review four suggestion cards and accept, reject, or modify them.",
      final_edit: "Finalize the message, then continue to the survey."
    },
    thought_partner: {
      scenario_intro: "Read the scenario, then click 'Start When Ready' to begin writing.",
      bullet_input:
        "Write 3-5 bullet points describing the **situation**. The AI will use these to ask you some questions to help you think through what you want to say.",
      reflection_questions: "Answer the questions one at a time.",
      reflection_summary: "Review your responses, then draft the message on your own.",
      independent_drafting: `Draft the message on your own. The ${conditionLabel} is no longer available.`,
      final_edit: "Finalize the message, then continue to the survey."
    }
  };

  return prompts[condition][state] ?? "Follow the instructions shown in the interface.";
}

export function getScenarioClosingInstruction(condition: Condition): string {
  if (condition === "ghost_writer") {
    return "Use 3-5 bullet points to brief the AI on the situation and what you'd like the message to accomplish. Aim for roughly 80-150 words in your final message.";
  }

  if (condition === "editor") {
    return "Write a complete first draft in your own words. Don't worry about getting the wording perfect; the AI will suggest ways to improve it afterward. Aim for roughly 80-150 words. You control the final wording and can keep your original text.";
  }

  return "Write 3-5 bullet points describing the situation, then draft the message independently after the brainstorm step. Aim for roughly 80-150 words in your final message.";
}

export function splitBoldText(text: string): Array<{ text: string; bold: boolean }> {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((segment) => {
      const isBold = segment.startsWith("**") && segment.endsWith("**");
      return {
        text: isBold ? segment.slice(2, -2) : segment,
        bold: isBold
      };
    });
}

export function visibleSurveyItems(
  template: SurveyTemplate,
  answers: Record<string, SurveyValue> = {},
  condition?: Condition
): SurveyItem[] {
  return filterVisibleSurveyItems(template.items, answers, condition);
}

export function missingRequiredItems(items: SurveyItem[], answers: Record<string, SurveyValue>): string[] {
  return items
    .filter((item) => item.required)
    .filter((item) => {
      const value = answers[item.id];
      if (value === undefined || value === null) {
        return true;
      }
      if (typeof value === "string") {
        return value.trim().length === 0;
      }
      if (typeof value === "number") {
        return Number.isNaN(value);
      }
      if (Array.isArray(value)) {
        const filtered = value.filter((entry) => entry.trim().length > 0);
        return filtered.length !== (item.options?.length ?? 0) || new Set(filtered).size !== filtered.length;
      }
      return true;
    })
    .map((item) => item.prompt);
}

function expandToFullSentence(fullText: string, segment: string): string {
  const idx = fullText.indexOf(segment);
  if (idx === -1) return segment;
  let start = 0;
  for (let i = idx - 1; i >= 0; i -= 1) {
    const ch = fullText[i];
    if (ch === "." || ch === "!" || ch === "?") {
      start = i + 2;
      break;
    }
    if (ch === "\n") {
      start = i + 1;
      break;
    }
  }
  while (start < idx && fullText[start] === " ") start += 1;
  const segEnd = idx + segment.length;
  let end = fullText.length;
  for (let i = segEnd; i < fullText.length; i += 1) {
    const ch = fullText[i];
    if (ch === "." || ch === "!" || ch === "?") {
      end = i + 1;
      break;
    }
    if (ch === "\n") {
      end = i;
      break;
    }
  }
  return fullText.slice(start, end).trim();
}

function normalizeComparableText(text: string): string {
  return text
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/^\s*(\.\.\.)+\s*/, "")
    .replace(/\s*(\.\.\.)+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function findReplacementTarget(fullText: string, target: string): string | null {
  const rawTarget = target.trim();
  const trimmedTarget = rawTarget
    .replace(/^\s*(\.\.\.)+\s*/, "")
    .replace(/\s*(\.\.\.)+\s*$/, "")
    .replace(/^["“”'‘’]+|["“”'‘’]+$/g, "")
    .trim();

  const candidateTargets = Array.from(new Set([rawTarget, trimmedTarget].filter(Boolean)));

  for (const candidate of candidateTargets) {
    if (fullText.includes(candidate)) {
      return candidate;
    }

    const expanded = expandToFullSentence(fullText, candidate);
    if (expanded !== candidate && fullText.includes(expanded)) {
      return expanded;
    }
  }

  const normalizedTarget = normalizeComparableText(trimmedTarget || rawTarget);
  if (!normalizedTarget) {
    return null;
  }

  for (const match of fullText.matchAll(/[^.!?\n]+[.!?]?/g)) {
    const sentence = match[0].trim();
    if (!sentence) {
      continue;
    }

    const normalizedSentence = normalizeComparableText(sentence);
    if (
      normalizedSentence === normalizedTarget ||
      normalizedSentence.includes(normalizedTarget) ||
      normalizedTarget.includes(normalizedSentence)
    ) {
      return sentence;
    }
  }

  return null;
}

export function applyReplacementToEditor(
  fullText: string,
  target: string,
  replacement: string
): {
  nextText: string;
  matchedText: string;
  matchStart: number;
  matchEnd: number;
  replacementEnd: number;
} | null {
  const matchedText = findReplacementTarget(fullText, target);
  if (!matchedText || !fullText.includes(matchedText)) {
    return null;
  }

  const matchStart = fullText.indexOf(matchedText);
  if (matchStart === -1) {
    return null;
  }
  const matchEnd = matchStart + matchedText.length;

  return {
    nextText: `${fullText.slice(0, matchStart)}${replacement}${fullText.slice(matchEnd)}`,
    matchedText,
    matchStart,
    matchEnd,
    replacementEnd: matchStart + replacement.length
  };
}

export function updateEditorHighlightRanges(
  ranges: EditorHighlightRange[],
  params: {
    suggestionId: number;
    matchStart: number;
    matchEnd: number;
    replacementEnd: number;
    status: HighlightStatus;
  }
): EditorHighlightRange[] {
  const delta = (params.replacementEnd - params.matchStart) - (params.matchEnd - params.matchStart);

  const nextRanges = ranges.flatMap((range) => {
    if (range.id === params.suggestionId) {
      return [];
    }
    if (range.end <= params.matchStart) {
      return [range];
    }
    if (range.start >= params.matchEnd) {
      return [
        {
          ...range,
          start: range.start + delta,
          end: range.end + delta
        }
      ];
    }
    return [];
  });

  nextRanges.push({
    id: params.suggestionId,
    start: params.matchStart,
    end: params.replacementEnd,
    status: params.status
  });

  return nextRanges.sort((left, right) => left.start - right.start);
}

export function buildEditorPreviewSegments(
  text: string,
  ranges: EditorHighlightRange[]
): Array<{ text: string; status: HighlightStatus | null }> {
  if (ranges.length === 0) {
    return [{ text, status: null }];
  }

  const sorted = [...ranges]
    .filter((range) => range.start < range.end && range.start < text.length)
    .sort((left, right) => left.start - right.start);

  const segments: Array<{ text: string; status: HighlightStatus | null }> = [];
  let cursor = 0;

  for (const range of sorted) {
    const start = Math.max(0, range.start);
    const end = Math.min(text.length, range.end);
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), status: null });
    }
    if (end > start) {
      segments.push({ text: text.slice(start, end), status: range.status });
    }
    cursor = Math.max(cursor, end);
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), status: null });
  }

  return segments.length > 0 ? segments : [{ text, status: null }];
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function isTrackedEditingKeystroke(params: {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}): boolean {
  if (params.altKey || params.ctrlKey || params.metaKey) {
    return false;
  }

  if (params.key.length === 1) {
    return true;
  }

  return params.key === "Backspace" || params.key === "Delete" || params.key === "Enter";
}

export function bulletInputGuidance(condition: Condition): BulletInputGuidance {
  if (condition === "thought_partner") {
    return {
      whatAiDoes: [],
      tooltip: "The AI will use your bullets to ask a few questions before you draft.",
      showExample: false,
      exampleTitle: "",
      exampleBullets: []
    };
  }

  if (condition === "editor") {
    return {
      whatAiDoes: [],
      tooltip: "The AI reviews your draft and suggests wording improvements. You choose what to keep.",
      showExample: false,
      exampleTitle: "Example draft target",
      exampleBullets: [
        "Draft should include what happened, acknowledgment of impact, apology, and next step.",
        "Write as if you are sending it now; avoid placeholders like 'insert apology here'."
      ]
    };
  }

  return {
    whatAiDoes: [],
    tooltip:
      "The AI assistant writes one full draft from your 3-5 bullets. No regenerate button is available. You can then edit the draft before submission.",
    showExample: false,
    exampleTitle: "",
    exampleBullets: []
  };
}
