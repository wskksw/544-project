"use client";

import { SurveyQuestionField, type SurveyValue } from "@/components/surveys/SurveyQuestionField";
import { visibleSurveyItems as filterVisibleSurveyItems } from "@/lib/surveyItems";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Condition = "thought_partner" | "editor" | "ghost_writer";
type StudyState =
  | "practice_intro"
  | "practice_task"
  | "practice_survey"
  | "scenario_intro"
  | "bullet_input"
  | "human_drafting"
  | "ai_generation"
  | "ai_revision"
  | "reflection_questions"
  | "reflection_summary"
  | "independent_drafting"
  | "final_edit"
  | "post_condition_survey"
  | "inter_condition_buffer"
  | "post_study_survey";

type SurveyItem = {
  id: string;
  prompt: string;
  type: "likert" | "open_text" | "multiple_choice" | "ranking";
  required: boolean;
  condition: Condition | "all";
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: string[];
  options?: string[];
  dependsOnItemId?: string;
  dependsOnValue?: string[];
};

type SurveyTemplate = {
  id: "per_condition" | "post_study";
  title: string;
  intro: string;
  items: SurveyItem[];
};

const PRACTICE_SURVEY_ITEMS: SurveyItem[] = [
  {
    id: "practice_ready",
    prompt: "I understand how to use the study interface.",
    type: "likert",
    required: true,
    condition: "all",
    scaleMin: 1,
    scaleMax: 7,
    scaleLabels: [
      "Strongly disagree",
      "Disagree",
      "Somewhat disagree",
      "Neutral",
      "Somewhat agree",
      "Agree",
      "Strongly agree"
    ]
  },
  {
    id: "practice_notes",
    prompt: "Anything about the interface still feels confusing? (optional)",
    type: "open_text",
    required: false,
    condition: "all"
  }
];

type SessionPayload = {
  session: {
    id: string;
    participantId: string;
    participantLabel: string;
    accessCode: string;
    isPlayground: boolean;
    status: "active" | "completed";
    currentTrialIndex: number;
    currentState: StudyState;
  };
  currentTrial: {
    trial_index: number;
    scenario_id: string;
    condition: Condition;
    order_position: number;
    status: string;
    started_at: string | null;
    scenario: {
      id: string;
      title: string;
      description: string;
      requiredElements: string[];
    };
  };
  allTrials: Array<{
    trial_index: number;
    scenario_id: string;
    condition: Condition;
    order_position: number;
    status: string;
  }>;
  conditionSurveyTemplate: SurveyTemplate;
  postStudySurveyTemplate: SurveyTemplate;
  completionCode: string;
};

type Suggestion = {
  id: number;
  originalSegment: string;
  suggestedChange: string;
  category: "tone" | "specificity" | "empathy" | "clarity";
  reasonText: string;
};

type ThoughtPartnerOutput = {
  reflectiveQuestions: string[];
};

function getConditionLabel(condition: Condition, forParticipant = false): string {
  switch (condition) {
    case "thought_partner":
      return "Thought Partner";
    case "editor":
      return "Editor";
    case "ghost_writer":
      return "Ghost-writer";
  }
}

function getScenarioLabel(scenarioId: string): string {
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

function getPromptText(condition: Condition, state: StudyState): string {
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
      bullet_input: "Enter 3-5 bullet points before one-time draft generation.",
      ai_generation: "Generate a single Ghost-writer draft from the participant bullets only.",
      final_edit: "Edit the generated draft freely, then continue to the survey."
    },
    editor: {
      scenario_intro: "Read the scenario, then click 'Start When Ready' to begin writing.",
      human_drafting: "Write a full message yourself before requesting suggestions.",
      ai_revision: "Review four suggestion cards and accept, reject, or modify them.",
      final_edit: "Finalize the message, then continue to the survey."
    },
    thought_partner: {
      scenario_intro: "Read the scenario, then click 'Start When Ready' to begin writing.",
      bullet_input: "Write 3-5 bullet points describing the situation. The AI will ask questions next.",
      reflection_questions: "Answer the questions from AI one at a time.",
      reflection_summary: "Review your responses, then draft independently.",
      independent_drafting: "Write the message independently. AI is no longer available.",
      final_edit: "Finalize the message, then continue to the survey."
    }
  };

  return prompts[condition][state] ?? "Follow the instructions shown in the interface.";
}

function visibleSurveyItems(
  template: SurveyTemplate,
  answers: Record<string, SurveyValue> = {},
  condition?: Condition
): SurveyItem[] {
  return filterVisibleSurveyItems(template.items, answers, condition);
}

function missingRequiredItems(items: SurveyItem[], answers: Record<string, SurveyValue>): string[] {
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
  for (let i = idx - 1; i >= 0; i--) {
    const ch = fullText[i];
    if (ch === "." || ch === "!" || ch === "?") { start = i + 2; break; }
    if (ch === "\n") { start = i + 1; break; }
  }
  while (start < idx && fullText[start] === " ") start++;
  const segEnd = idx + segment.length;
  let end = fullText.length;
  for (let i = segEnd; i < fullText.length; i++) {
    const ch = fullText[i];
    if (ch === "." || ch === "!" || ch === "?") { end = i + 1; break; }
    if (ch === "\n") { end = i; break; }
  }
  return fullText.slice(start, end).trim();
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function StudyWorkspace({
  sessionId,
  portalMode = "researcher",
  participantAccessCode
}: {
  sessionId: string;
  portalMode?: "researcher" | "participant";
  participantAccessCode?: string;
}) {
  const [snapshot, setSnapshot] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [aiPanelError, setAiPanelError] = useState("");

  const [editorText, setEditorText] = useState("");
  const [bullets, setBullets] = useState<string[]>(["", "", ""]);
  const [hasGeneratedDraft, setHasGeneratedDraft] = useState(false);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionActions, setSuggestionActions] = useState<Record<number, string>>({});

  const [thoughtPartnerOutput, setThoughtPartnerOutput] = useState<ThoughtPartnerOutput | null>(null);
  const [questionAnswers, setQuestionAnswers] = useState<Record<number, string>>({});
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

  const [conditionSurveyAnswers, setConditionSurveyAnswers] = useState<Record<string, SurveyValue>>({});
  const [postStudyAnswers, setPostStudyAnswers] = useState<Record<string, SurveyValue>>({});
  const [practiceText, setPracticeText] = useState("");
  const [practiceSurveyAnswers, setPracticeSurveyAnswers] = useState<Record<string, SurveyValue>>({});

  const [modifyingId, setModifyingId] = useState<number | null>(null);
  const [modifyText, setModifyText] = useState("");
  const [practiceNudge, setPracticeNudge] = useState<string | null>(null);
  const [practiceNudgeRequested, setPracticeNudgeRequested] = useState(false);

  const [keystrokeCount, setKeystrokeCount] = useState(0);
  const [ghostWriterEditCount, setGhostWriterEditCount] = useState(0);
  const [reflectionStartedAt, setReflectionStartedAt] = useState<number | null>(null);
  const [reflectionDurationSec, setReflectionDurationSec] = useState<number | null>(null);

  const seenPromptKeys = useRef<Set<string>>(new Set());
  const surveyRef = useRef<HTMLElement>(null);
  const [clock, setClock] = useState(Date.now());
  const trialIdentity = snapshot ? `${snapshot.session.id}:${snapshot.currentTrial.trial_index}` : "uninitialized";

  const fetchJson = useCallback(async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(url, init);
    const json = (await response.json()) as T & { error?: string };
    if (!response.ok) {
      throw new Error(json.error ?? "Request failed");
    }
    return json;
  }, []);

  const loadSnapshot = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError("");
    setAiPanelError("");
    try {
      const next = await fetchJson<SessionPayload>(`/api/session/${sessionId}`);
      setSnapshot(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session");
    } finally {
      setLoading(false);
    }
  }, [fetchJson, sessionId]);

  const logEvent = useCallback(
    async (eventType: string, payload?: unknown): Promise<void> => {
      if (!snapshot) {
        return;
      }
      await fetch(`/api/session/${sessionId}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trialIndex:
            snapshot.session.currentState === "practice_intro" ||
              snapshot.session.currentState === "practice_task" ||
              snapshot.session.currentState === "practice_survey"
              ? null
              : snapshot.currentTrial.trial_index,
          eventType,
          payload
        })
      });
    },
    [sessionId, snapshot]
  );

  async function transition(toState: StudyState, payload?: unknown): Promise<void> {
    await fetchJson(`/api/session/${sessionId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toState, payload })
    });
    await loadSnapshot();
  }

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    setEditorText("");
    setBullets(["", "", ""]);
    setHasGeneratedDraft(false);
    setSuggestions([]);
    setSuggestionActions({});
    setAiPanelError("");
    setModifyingId(null);
    setModifyText("");
    setThoughtPartnerOutput(null);
    setQuestionAnswers({});
    setActiveQuestionIndex(0);
    setConditionSurveyAnswers({});
    setPracticeText("");
    setPracticeSurveyAnswers({});
    setPracticeNudge(null);
    setPracticeNudgeRequested(false);
    setKeystrokeCount(0);
    setGhostWriterEditCount(0);
    setReflectionStartedAt(null);
    setReflectionDurationSec(null);
    setAiPanelError("");
    seenPromptKeys.current.clear();
  }, [trialIdentity]);

  useEffect(() => {
    setPostStudyAnswers({});
  }, [sessionId]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!snapshot || snapshot.session.currentState === "post_study_survey") {
      return;
    }

    const key = `${trialIdentity}:${snapshot.session.currentState}`;
    if (seenPromptKeys.current.has(key)) {
      return;
    }
    seenPromptKeys.current.add(key);
    void logEvent("prompt_shown", {
      state: snapshot.session.currentState,
      condition: snapshot.currentTrial.condition,
      scenario: snapshot.currentTrial.scenario_id,
      promptText: getPromptText(snapshot.currentTrial.condition, snapshot.session.currentState),
      scenarioChecklist: snapshot.currentTrial.scenario.requiredElements
    });
  }, [logEvent, snapshot, trialIdentity]);

  useEffect(() => {
    if (!snapshot || snapshot.session.currentState === "post_study_survey") {
      return;
    }

    const handle = window.setTimeout(() => {
      void logEvent("editor_snapshot", {
        state: snapshot.session.currentState,
        text: editorText,
        length: editorText.length
      });
    }, 1200);

    return () => window.clearTimeout(handle);
  }, [editorText, logEvent, snapshot]);

  useEffect(() => {
    if (snapshot?.session.currentState === "post_condition_survey") {
      const timer = window.setTimeout(() => {
        surveyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
      return () => window.clearTimeout(timer);
    }
  }, [snapshot?.session.currentState]);

  useEffect(() => {
    if (!snapshot || snapshot.session.currentState === "post_study_survey") {
      return;
    }

    const startedAt = snapshot.currentTrial.started_at;
    const state = snapshot.session.currentState;
    const handle = window.setInterval(() => {
      const elapsedSec = startedAt
        ? Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
        : 0;
      void logEvent("timer_heartbeat", { elapsedSec, state });
    }, 30000);

    return () => window.clearInterval(handle);
  }, [logEvent, snapshot, snapshot?.session.currentState, snapshot?.currentTrial.started_at]);

  const elapsedSeconds = useMemo(() => {
    if (!snapshot?.currentTrial.started_at) {
      return 0;
    }
    return Math.max(0, Math.floor((clock - new Date(snapshot.currentTrial.started_at).getTime()) / 1000));
  }, [clock, snapshot]);

  const wordCount = useMemo(() => countWords(editorText), [editorText]);

  async function startConditionFlow(): Promise<void> {
    if (!snapshot) {
      return;
    }
    const toState = snapshot.currentTrial.condition === "editor" ? "human_drafting" : "bullet_input";
    setBusy(true);
    setError("");
    try {
      await fetchJson(`/api/session/${sessionId}/start-trial`, { method: "POST" });
      await transition(toState);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start condition");
    } finally {
      setBusy(false);
    }
  }

  async function startPracticeTask(): Promise<void> {
    setBusy(true);
    setError("");
    try {
      await transition("practice_task");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open practice task");
    } finally {
      setBusy(false);
    }
  }

  async function requestPracticeNudge(): Promise<void> {
    if (!practiceText.trim()) {
      setError("Write a short reply first so the AI has something to work with.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const json = await fetchJson<{ nudge: string }>(`/api/session/${sessionId}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "practice_nudge", message: practiceText })
      });
      setPracticeNudge(json.nudge);
      setPracticeNudgeRequested(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get AI suggestion");
    } finally {
      setBusy(false);
    }
  }

  async function continueToPracticeSurvey(): Promise<void> {
    if (!practiceText.trim()) {
      setError("Write a short practice reply before continuing.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await transition("practice_survey");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open practice survey");
    } finally {
      setBusy(false);
    }
  }

  async function submitPracticeRound(): Promise<void> {
    const missing = missingRequiredItems(PRACTICE_SURVEY_ITEMS, practiceSurveyAnswers);
    if (missing.length > 0) {
      setError("Please complete the required practice survey item.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await fetchJson(`/api/session/${sessionId}/practice-submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practiceMessageText: practiceText,
          surveyResponses: practiceSurveyAnswers
        })
      });
      setPracticeText("");
      setPracticeSurveyAnswers({});
      setPracticeNudge(null);
      setPracticeNudgeRequested(false);
      setEditorText("");
      setBullets(["", "", ""]);
      setKeystrokeCount(0);
      setGhostWriterEditCount(0);
      setReflectionStartedAt(null);
      setReflectionDurationSec(null);
      setSuggestions([]);
      setSuggestionActions({});
      setThoughtPartnerOutput(null);
      setQuestionAnswers({});
      setActiveQuestionIndex(0);
      setConditionSurveyAnswers({});
      await loadSnapshot();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit practice round");
    } finally {
      setBusy(false);
    }
  }

  function reflectionPairs(): Array<{ questionOrder: number; question: string; response: string }> {
    const questions = thoughtPartnerOutput?.reflectiveQuestions ?? [];
    return questions.map((question, index) => ({
      questionOrder: index + 1,
      question,
      response: questionAnswers[index] ?? ""
    }));
  }

  function handleEditorChange(nextText: string): void {
    setEditorText(nextText);
    if (snapshot?.currentTrial.condition === "ghost_writer" && hasGeneratedDraft) {
      setGhostWriterEditCount((prev) => prev + 1);
    }
  }

  async function runGhostWriterGenerate(): Promise<void> {
    if (!snapshot) {
      return;
    }
    const compactBullets = bullets.map((item) => item.trim()).filter(Boolean);
    if (compactBullets.length < 3 || compactBullets.length > 5) {
      setAiPanelError("Please provide 3–5 bullet points before generating.");
      return;
    }

    setBusy(true);
    setAiPanelError("");
    try {
      await transition("ai_generation", { bulletCount: compactBullets.length });
      const json = await fetchJson<{ draft: string }>(`/api/session/${sessionId}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ghost_writer_generate", bullets: compactBullets })
      });
      setEditorText(json.draft);
      setHasGeneratedDraft(true);
      await transition("final_edit", { generated: true });
    } catch (err) {
      setAiPanelError(err instanceof Error ? err.message : "Ghost-writer generation failed");
    } finally {
      setBusy(false);
    }
  }

  async function runEditorSuggestions(): Promise<void> {
    if (!snapshot) {
      return;
    }
    if (!editorText.trim()) {
      setAiPanelError("Write a full message before requesting suggestions.");
      return;
    }

    setBusy(true);
    setAiPanelError("");
    try {
      await transition("ai_revision", { messageLength: editorText.length });
      const json = await fetchJson<{ suggestions: Suggestion[] }>(`/api/session/${sessionId}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "editor_suggest", message: editorText })
      });

      setSuggestions(json.suggestions);
      const actions: Record<number, string> = {};
      json.suggestions.forEach((item) => {
        actions[item.id] = "pending";
      });
      setSuggestionActions(actions);
    } catch (err) {
      setAiPanelError(err instanceof Error ? err.message : "Failed to get suggestions");
    } finally {
      setBusy(false);
    }
  }

  async function applySuggestion(suggestion: Suggestion, action: "accept" | "reject" | "modify", modifiedText?: string): Promise<void> {
    let userModifiedText: string | null = null;

    // Use the full-sentence span for replacement so the swap is always a complete sentence
    const replaceTarget = expandToFullSentence(editorText, suggestion.originalSegment);

    if (action === "accept") {
      if (editorText.includes(replaceTarget)) {
        setEditorText(editorText.replace(replaceTarget, suggestion.suggestedChange));
      } else if (editorText.includes(suggestion.originalSegment)) {
        setEditorText(editorText.replace(suggestion.originalSegment, suggestion.suggestedChange));
      }
    }

    if (action === "modify") {
      userModifiedText = modifiedText?.trim() ?? "";
      if (!userModifiedText) {
        return;
      }
      if (editorText.includes(replaceTarget)) {
        setEditorText(editorText.replace(replaceTarget, userModifiedText));
      } else if (editorText.includes(suggestion.originalSegment)) {
        setEditorText(editorText.replace(suggestion.originalSegment, userModifiedText));
      }
    }

    setSuggestionActions((prev) => ({ ...prev, [suggestion.id]: action }));
    const fetchBody: Record<string, unknown> = {
      suggestionId: suggestion.id,
      actionStatus: action
    };
    if (userModifiedText !== null) {
      fetchBody.userModifiedText = userModifiedText;
    }
    await fetchJson(`/api/session/${sessionId}/editor-action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fetchBody)
    });
  }

  async function startThoughtPartnerQuestions(): Promise<void> {
    const compactBullets = bullets.map((item) => item.trim()).filter(Boolean);
    if (compactBullets.length < 3 || compactBullets.length > 5) {
      setAiPanelError("Please provide 3–5 bullet points describing the situation.");
      return;
    }

    setBusy(true);
    setAiPanelError("");
    try {
      await transition("reflection_questions", { bulletCount: compactBullets.length });
      const json = await fetchJson<{ thoughtPartner: ThoughtPartnerOutput }>(`/api/session/${sessionId}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "thought_partner_questions", bullets: compactBullets })
      });
      setThoughtPartnerOutput(json.thoughtPartner);
      setActiveQuestionIndex(0);
      setReflectionStartedAt(Date.now());
    } catch (err) {
      setAiPanelError(err instanceof Error ? err.message : "Failed to start reflective questions");
    } finally {
      setBusy(false);
    }
  }

  function continueQuestionFlow(): void {
    const answer = (questionAnswers[activeQuestionIndex] ?? "").trim();
    if (!answer) {
      setAiPanelError("Please answer the current reflection question before continuing.");
      return;
    }
    setAiPanelError("");
    setActiveQuestionIndex((prev) => Math.min(prev + 1, (thoughtPartnerOutput?.reflectiveQuestions.length ?? 1) - 1));
  }

  async function finishReflections(): Promise<void> {
    const reflections = reflectionPairs().filter((pair) => pair.response.trim().length > 0);
    if (reflections.length !== 4) {
      setAiPanelError("All four reflection questions must be answered before continuing.");
      return;
    }

    setBusy(true);
    setAiPanelError("");
    try {
      await transition("reflection_summary", { reflectionCount: reflections.length });
      if (reflectionStartedAt) {
        setReflectionDurationSec(Math.max(0, Math.floor((Date.now() - reflectionStartedAt) / 1000)));
      }
    } catch (err) {
      setAiPanelError(err instanceof Error ? err.message : "Failed to finish reflections");
    } finally {
      setBusy(false);
    }
  }

  async function toIndependentDrafting(): Promise<void> {
    setBusy(true);
    setError("");
    try {
      await transition("independent_drafting");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open independent drafting");
    } finally {
      setBusy(false);
    }
  }

  async function toFinalEdit(): Promise<void> {
    setBusy(true);
    setError("");
    try {
      await transition("final_edit");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to transition to final edit");
    } finally {
      setBusy(false);
    }
  }

  async function toSurvey(): Promise<void> {
    setBusy(true);
    setError("");
    try {
      await transition("post_condition_survey");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open survey");
    } finally {
      setBusy(false);
    }
  }

  async function submitSurveyAndAdvance(): Promise<void> {
    if (!snapshot) {
      return;
    }

    const surveyItems = visibleSurveyItems(
      snapshot.conditionSurveyTemplate,
      conditionSurveyAnswers,
      snapshot.currentTrial.condition
    );
    const missing = missingRequiredItems(surveyItems, conditionSurveyAnswers);
    if (missing.length > 0) {
      setError("Please complete all required post-condition survey fields.");
      return;
    }

    const surveyResponses: Record<string, unknown> = {};
    for (const item of surveyItems) {
      surveyResponses[item.id] = conditionSurveyAnswers[item.id] ?? null;
    }

    const finalLength = editorText.trim().length;
    const interactionMetrics = {
      keystrokeCount,
      selfAuthoredTextRatio: finalLength > 0 ? Math.min(1, keystrokeCount / finalLength) : null,
      ghostWriterEditCount: snapshot.currentTrial.condition === "ghost_writer" ? ghostWriterEditCount : null,
      reflectionDurationSec: snapshot.currentTrial.condition === "thought_partner" ? reflectionDurationSec : null
    };

    setBusy(true);
    setError("");
    try {
      await fetchJson(`/api/session/${sessionId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveyResponses,
          finalMessageText: editorText,
          thoughtPartnerResponses:
            snapshot.currentTrial.condition === "thought_partner"
              ? reflectionPairs().filter((pair) => pair.response.trim().length > 0)
              : undefined,
          interactionMetrics
        })
      });
      await loadSnapshot();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitPostStudySurvey(): Promise<void> {
    if (!snapshot) {
      return;
    }

    const surveyItems = visibleSurveyItems(snapshot.postStudySurveyTemplate, postStudyAnswers);
    const missing = missingRequiredItems(surveyItems, postStudyAnswers);
    if (missing.length > 0) {
      setError("Please complete all required final survey fields.");
      return;
    }

    const responses: Record<string, unknown> = {};
    for (const item of surveyItems) {
      responses[item.id] = postStudyAnswers[item.id] ?? null;
    }

    setBusy(true);
    setError("");
    try {
      await fetchJson(`/api/session/${sessionId}/post-study-submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses })
      });
      await loadSnapshot();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Final survey submission failed");
    } finally {
      setBusy(false);
    }
  }

  const editorEnabled = useMemo(() => {
    if (!snapshot) {
      return false;
    }
    const state = snapshot.session.currentState;
    return (
      state === "human_drafting" ||
      state === "independent_drafting" ||
      state === "final_edit"
    );
  }, [snapshot]);

  const allSuggestionsActioned =
    suggestions.length > 0 &&
    Object.values(suggestionActions).every((a) => a !== "pending");

  const currentQuestion = thoughtPartnerOutput?.reflectiveQuestions[activeQuestionIndex];
  const allQuestionsAnswered =
    thoughtPartnerOutput?.reflectiveQuestions.every((_, index) => (questionAnswers[index] ?? "").trim().length > 0) ?? false;

  if (loading) {
    return <div className="card">Loading session...</div>;
  }

  if (error && !snapshot) {
    return (
      <div className="card">
        <p>{error}</p>
        {portalMode === "participant" ? <Link href="/study">Back to study login</Link> : <Link href="/researcher">Back to researcher panel</Link>}
      </div>
    );
  }

  if (!snapshot) {
    return <div className="card">Session unavailable.</div>;
  }

  if (snapshot.session.status === "completed") {
    if (portalMode === "participant") {
      return (
        <div className="card">
          <h1>Thank you for participating in our study.</h1>
        </div>
      );
    }

    return (
      <div className="card">
        <h1>Study Complete</h1>
        <p>
          Participant: {snapshot.session.participantLabel} ({snapshot.session.accessCode})
        </p>
        <p>
          Completion code: <strong>{snapshot.completionCode}</strong>
        </p>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <Link href="/researcher">
            <button type="button">Back to Console</button>
          </Link>
          <a href="/api/researcher/export" target="_blank" rel="noreferrer">
            <button type="button">Export Data</button>
          </a>
        </div>
      </div>
    );
  }

  const currentState = snapshot.session.currentState;
  const condition = snapshot.currentTrial.condition;

  if (currentState === "inter_condition_buffer") {
    const completedRound = Math.max(1, snapshot.currentTrial.order_position - 1);

    return (
      <div className="card" style={{ maxWidth: 760, margin: "0 auto" }}>
        <h1>Round Complete</h1>
        <p style={{ color: "black" }}>
          You&apos;ve completed Round {completedRound} of {snapshot.allTrials.length}. Take a brief moment, then click Next when you&apos;re ready to continue.
        </p>
        <div style={{ marginTop: "0.9rem" }}>
          <button
            className="primary"
            type="button"
            disabled={busy}
            onClick={() => void transition("scenario_intro")}
          >
            Next
          </button>
        </div>
        {error ? <p style={{ color: "var(--warn)", marginTop: "0.6rem" }}>{error}</p> : null}
      </div>
    );
  }

  if (currentState === "post_study_survey") {
    const finalTemplate =
      portalMode === "participant"
        ? {
          ...snapshot.postStudySurveyTemplate,
          items: snapshot.postStudySurveyTemplate.items.map((item) =>
            item.id === "overall_preference_ranking"
              ? {
                ...item,
                prompt:
                  "Rank the three writing workflows from most preferred to least preferred.",
                options: [
                  "Workflow A: AI asked reflective questions, then you wrote independently",
                  "Workflow B: You wrote first, then reviewed AI revision suggestions",
                  "Workflow C: You gave bullet points and AI generated one draft"
                ]
              }
              : item
          )
        }
        : snapshot.postStudySurveyTemplate;

    const finalItems = visibleSurveyItems(finalTemplate, postStudyAnswers);

    return (
      <div className="card" style={{ maxWidth: 860, margin: "0 auto" }}>
        <h1>{finalTemplate.title}</h1>
        <p style={{ color: "black" }}>{finalTemplate.intro}</p>
        <p style={{ color: "black" }}>All condition blocks are complete. Submit this final survey to finish the study.</p>

        <div style={{ display: "grid", gap: "0.8rem" }}>
          {finalItems.map((item) => (
            <SurveyQuestionField
              key={item.id}
              item={item}
              value={postStudyAnswers[item.id]}
              disabled={busy}
              onChange={(next) => setPostStudyAnswers((prev) => ({ ...prev, [item.id]: next }))}
            />
          ))}
        </div>

        <div style={{ marginTop: "1rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button className="primary" type="button" disabled={busy} onClick={() => void submitPostStudySurvey()}>
            Submit Final Survey
          </button>
        </div>

        {error ? <p style={{ color: "var(--warn)" }}>{error}</p> : null}
      </div>
    );
  }

  const conditionSurveyItems = visibleSurveyItems(snapshot.conditionSurveyTemplate, conditionSurveyAnswers, condition);

  if (currentState === "practice_intro" || currentState === "practice_task" || currentState === "practice_survey") {
    return (
      <div className="layout-grid">
        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              {portalMode === "participant" ? (
                <>
                  <strong>Access Code:</strong> {participantAccessCode ?? snapshot.session.accessCode}
                </>
              ) : (
                <>
                  <strong>Session:</strong> {snapshot.session.id.slice(0, 8)} | <strong>Participant:</strong>{" "}
                  {snapshot.session.participantLabel} ({snapshot.session.accessCode})
                </>
              )}
            </div>
            <div>
              <span className="tag" title="This short onboarding round is not part of the 3-condition comparison.">
                Practice Round
              </span>{" "}
              {portalMode === "researcher" ? <span className="tag">State: {currentState}</span> : null}
            </div>
          </div>
        </section>

        {currentState === "practice_intro" ? (
          <div className="workspace-grid">
            <section className="card">
              <div style={{ display: "grid", gap: "0.9rem" }}>
                <h1 title="This round is only for learning the interface.">Practice Round</h1>
                <p style={{ color: "black" }}>
                  Before the real study begins, complete this short practice round to get familiar with the interface
                  including the AI side panel on the right.
                </p>
                <p style={{ color: "black" }}>
                  The practice task is not part of the main analysis. It should take about two minutes.
                </p>
                <button
                  className="primary"
                  type="button"
                  disabled={busy}
                  title="Opens a simple warm-up writing task."
                  onClick={() => void startPracticeTask()}
                >
                  Start When Ready
                </button>
              </div>
            </section>
            <section className="card">
              <h2>AI Side Panel</h2>
              <p style={{ color: "var(--muted-foreground)" }}>
                The AI assistant will appear here once you start the practice task.
              </p>
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
                <p style={{ color: "black" }}>
                  Write a short reply. This is just to get used to the editor and the AI side panel.
                </p>
                <textarea
                  value={practiceText}
                  onChange={(event) => setPracticeText(event.target.value)}
                  placeholder="Write a short reply here..."
                  disabled={busy}
                  style={{ minHeight: "180px" }}
                  title="This practice editor is separate from the real study blocks."
                />
                <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                  <span className="tag" title="Practice word count is not used in the experimental timing analysis.">
                    Word Count: {countWords(practiceText)}
                  </span>
                </div>
                <button
                  className="primary"
                  type="button"
                  disabled={busy}
                  title="Moves to the short practice feedback survey."
                  onClick={() => void continueToPracticeSurvey()}
                >
                  Continue to Practice Survey
                </button>
              </div>
            </section>
            <section className="card">
              <h2>AI Side Panel</h2>
              {!practiceNudgeRequested ? (
                <div style={{ display: "grid", gap: "0.7rem" }}>
                  <p style={{ color: "black" }}>
                    After writing your reply, click below to get a quick suggestion from the AI.
                  </p>
                  <button
                    className="primary"
                    type="button"
                    disabled={busy || !practiceText.trim()}
                    title="Get a single casual suggestion for your reply."
                    onClick={() => void requestPracticeNudge()}
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
              <h1 title="This quick survey checks whether the interface feels clear before the real study starts.">
                Practice Survey
              </h1>
              <p style={{ color: "black" }}>
                This short feedback round helps confirm you are comfortable with the interface before the timed study
                conditions begin.
              </p>
              <div style={{ display: "grid", gap: "0.8rem" }}>
                {PRACTICE_SURVEY_ITEMS.map((item) => (
                  <SurveyQuestionField
                    key={item.id}
                    item={item}
                    value={practiceSurveyAnswers[item.id]}
                    disabled={busy}
                    onChange={(next) => setPracticeSurveyAnswers((prev) => ({ ...prev, [item.id]: next }))}
                  />
                ))}
              </div>
              <button
                className="primary"
                type="button"
                disabled={busy}
                title="Completes practice and opens the first experimental block."
                onClick={() => void submitPracticeRound()}
              >
                Begin Study
              </button>
            </div>
          </section>
        ) : null}

        {error ? <p style={{ color: "var(--warn)", padding: "0 1rem" }}>{error}</p> : null}
      </div>
    );
  }

  const categoryLabels: Record<string, string> = {
    tone: "Tone",
    empathy: "Empathy",
    specificity: "Specificity",
    clarity: "Clarity"
  };

  const statusColors: Record<string, string> = {
    accept: "#16a34a",
    modify: "#d97706",
    reject: "#dc2626",
    pending: "#6b7280"
  };
  const statusLabels: Record<string, string> = {
    accept: "Accepted",
    modify: "Accepted w/ Change",
    reject: "Rejected",
    pending: "Not responded"
  };

  return (
    <div className="layout-grid">
      <section className="card" style={{ padding: "0.6rem 1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            {portalMode === "participant" ? (
              <>
                <strong>Access Code:</strong> {participantAccessCode ?? snapshot.session.accessCode}
              </>
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
                <span className="tag">Condition: {getConditionLabel(condition)}</span>{" "}
                <span className="tag">Scenario: {getScenarioLabel(snapshot.currentTrial.scenario_id)}</span>{" "}
                <span className="tag">State: {currentState}</span>{" "}
                <span className="tag">Elapsed: {elapsedSeconds}s</span>
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

      <div className="workspace-grid">
        <section className="card">
          <h2>{snapshot.currentTrial.scenario.title}</h2>
          <p style={{ color: "black", whiteSpace: "pre-wrap" }}>{snapshot.currentTrial.scenario.description}</p>

          <h3>Main Editor</h3>
          {(condition === "ghost_writer" && currentState === "bullet_input") ||
          (condition === "editor" && currentState === "ai_revision") ? (
            <div
              title={
                condition === "editor"
                  ? "Editor is locked — respond to each suggestion in the AI panel"
                  : "Enter your bullet points in the AI panel first"
              }
              style={{ cursor: "not-allowed", position: "relative" }}
            >
              <textarea
                value={editorText}
                placeholder={condition === "editor" ? "" : "The AI will generate a draft from your bullets..."}
                disabled
                style={{ minHeight: "260px", pointerEvents: "none" }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "repeating-linear-gradient(135deg, rgba(209,213,219,0.45) 0px, rgba(209,213,219,0.45) 10px, transparent 10px, transparent 20px)",
                  borderRadius: "calc(var(--radius) - 0.25rem)",
                  pointerEvents: "none"
                }}
              />
              {condition === "editor" ? (
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    background: "rgba(255,255,255,0.88)",
                    padding: "0.4rem 0.9rem",
                    borderRadius: 4,
                    fontSize: "0.85em",
                    color: "#374151",
                    pointerEvents: "none",
                    whiteSpace: "nowrap"
                  }}
                >
                  Locked — respond to suggestions in the AI panel
                </div>
              ) : null}
            </div>
          ) : (
            <textarea
              value={editorText}
              onChange={(event) => handleEditorChange(event.target.value)}
              onKeyDown={() => setKeystrokeCount((prev) => prev + 1)}
              placeholder="Write or edit your message here..."
              disabled={!editorEnabled || busy}
              style={{ minHeight: "260px" }}
            />
          )}

          <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <span className="tag" title="This updates live and is stored as a derived behavioral metric when you submit.">
              Word Count: {wordCount}
            </span>
            {wordCount > 0 && wordCount < 50 ? (
              <span className="tag" style={{ color: "var(--destructive)" }}>
                Your message seems quite short. Would you like to add more?
              </span>
            ) : null}
          </div>

          <div style={{ marginTop: "0.7rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            {currentState === "scenario_intro" ? (
              <button
                className="primary"
                disabled={busy}
                title="Starts the timed study block for this condition."
                onClick={() => void startConditionFlow()}
              >
                Start When Ready
              </button>
            ) : null}

            {currentState === "independent_drafting" ? (
              <button
                className="primary"
                disabled={busy || !editorText.trim()}
                title="Locks in your independent draft and moves to the final review step."
                onClick={() => void toFinalEdit()}
              >
                Continue to Final Review
              </button>
            ) : null}

            {currentState === "final_edit" ? (
              <button
                className="primary"
                disabled={busy}
                title="Opens the post-condition survey for this study block."
                onClick={() => void toSurvey()}
              >
                Continue to Post-Condition Survey
              </button>
            ) : null}
          </div>

          {error ? <p style={{ color: "var(--destructive)", marginTop: "0.5rem" }}>{error}</p> : null}
        </section>

        <section className="card">
          <h2>AI Assistant</h2>
          <p style={{ color: "black" }}>{getPromptText(condition, currentState)}</p>
          {aiPanelError ? <p style={{ color: "var(--destructive)", marginTop: "0.3rem" }}>{aiPanelError}</p> : null}

          {condition === "ghost_writer" ? (
            <div style={{ display: "grid", gap: "0.7rem", marginTop: "0.5rem" }}>
              {(currentState === "bullet_input" || currentState === "ai_generation") && (
                <>
                  {bullets.map((value, index) => (
                    <label key={index}>
                      Bullet {index + 1}
                      <textarea
                        value={value}
                        rows={3}
                        style={{ resize: "vertical" }}
                        onChange={(event) => {
                          const next = [...bullets];
                          next[index] = event.target.value;
                          setBullets(next);
                        }}
                        disabled={busy || hasGeneratedDraft}
                      />
                    </label>
                  ))}
                  {bullets.length < 5 ? (
                    <button
                      type="button"
                      disabled={busy || hasGeneratedDraft}
                      title="Adds an optional fourth or fifth bullet before generation."
                      onClick={() => setBullets((prev) => [...prev, ""])}
                    >
                      Add Bullet
                    </button>
                  ) : null}
                  <button
                    className="primary"
                    type="button"
                    disabled={busy || hasGeneratedDraft}
                    title="Generates one draft only from your bullets. Regeneration is intentionally disabled."
                    onClick={() => void runGhostWriterGenerate()}
                  >
                    {busy ? "Generating…" : "Generate Draft"}
                  </button>
                </>
              )}
              {(currentState === "final_edit" || currentState === "post_condition_survey") && hasGeneratedDraft ? (
                <div className="card" style={{ background: "var(--muted)" }}>
                  <p>
                    <strong>Draft generated from your bullets:</strong>
                  </p>
                  <ul style={{ marginTop: "0.4rem" }}>
                    {bullets.filter(Boolean).map((bullet, index) => (
                      <li key={index}>{bullet}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {hasGeneratedDraft && currentState !== "final_edit" && currentState !== "post_condition_survey" ? (
                <p>Draft generated. You may now edit in the main editor.</p>
              ) : null}
            </div>
          ) : null}

          {condition === "editor" ? (
            <div style={{ display: "grid", gap: "0.7rem", marginTop: "0.5rem" }}>
              {currentState === "human_drafting" ? (
                <button
                  className="primary"
                  type="button"
                  disabled={busy || !editorText.trim()}
                  title="Requests the fixed set of four editor suggestions."
                  onClick={() => void runEditorSuggestions()}
                >
                  Get Revision Suggestions
                </button>
              ) : null}

              {currentState === "ai_revision" ||
              currentState === "final_edit" ||
              currentState === "post_condition_survey" ? (
                <>
                  {currentState === "ai_revision" && suggestions.length === 0 ? (
                    <p
                      title={busy ? "Generating revision suggestions based on your draft…" : undefined}
                      style={{
                        fontStyle: busy ? "italic" : undefined,
                        color: busy ? "var(--muted-foreground)" : undefined
                      }}
                    >
                      {busy ? "Generating suggestions…" : "No suggestions generated."}
                    </p>
                  ) : null}

                  {suggestions.map((suggestion) => {
                    const status = suggestionActions[suggestion.id] ?? "pending";
                    const fullSentenceQuote = expandToFullSentence(editorText, suggestion.originalSegment);
                    const isModifying = modifyingId === suggestion.id;
                    return (
                      <div
                        className="card"
                        key={suggestion.id}
                        style={{ borderLeft: `3px solid ${statusColors[status] ?? "#6b7280"}` }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "0.4rem",
                            flexWrap: "wrap",
                            gap: "0.3rem"
                          }}
                        >
                          <span className="tag">{categoryLabels[suggestion.category] ?? suggestion.category}</span>
                          <span
                            className="tag"
                            style={{ color: statusColors[status], borderColor: statusColors[status] }}
                          >
                            {statusLabels[status] ?? status}
                          </span>
                        </div>
                        <p>
                          <strong>Original:</strong> <em>{fullSentenceQuote}</em>
                        </p>
                        <p style={{ marginTop: "0.3rem" }}>
                          <strong>Suggested:</strong> {suggestion.suggestedChange}
                        </p>
                        <p style={{ marginTop: "0.3rem", color: "var(--muted-foreground)", fontSize: "0.88em" }}>
                          <strong>Why:</strong> {suggestion.reasonText}
                        </p>
                        {currentState === "ai_revision" && status === "pending" ? (
                          isModifying ? (
                            <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.4rem" }}>
                              <textarea
                                value={modifyText}
                                rows={3}
                                style={{ resize: "vertical" }}
                                onChange={(event) => setModifyText(event.target.value)}
                                placeholder="Edit the suggestion before applying…"
                              />
                              <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button
                                  className="primary"
                                  type="button"
                                  disabled={!modifyText.trim()}
                                  onClick={() => {
                                    void applySuggestion(suggestion, "modify", modifyText);
                                    setModifyingId(null);
                                    setModifyText("");
                                  }}
                                >
                                  Apply
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setModifyingId(null);
                                    setModifyText("");
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                              <button
                                type="button"
                                title="Replace the original sentence with the suggested one."
                                onClick={() => void applySuggestion(suggestion, "accept")}
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                title="Edit the suggestion before applying it."
                                onClick={() => {
                                  setModifyingId(suggestion.id);
                                  setModifyText(suggestion.suggestedChange);
                                }}
                              >
                                Modify
                              </button>
                              <button
                                type="button"
                                title="Keep your original wording."
                                onClick={() => void applySuggestion(suggestion, "reject")}
                              >
                                Reject
                              </button>
                            </div>
                          )
                        ) : null}
                      </div>
                    );
                  })}

                  {currentState === "ai_revision" && allSuggestionsActioned ? (
                    <button
                      className="primary"
                      type="button"
                      title="Applies all changes and unlocks the editor for final edits."
                      onClick={() => void toFinalEdit()}
                    >
                      Continue to Final Review
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          {condition === "thought_partner" ? (
            <div style={{ display: "grid", gap: "0.7rem", marginTop: "0.5rem" }}>
              {currentState === "bullet_input" ? (
                <>
                  {bullets.map((value, index) => (
                    <label key={index}>
                      Bullet {index + 1}
                      <textarea
                        value={value}
                        rows={3}
                        style={{ resize: "vertical" }}
                        onChange={(event) => {
                          const next = [...bullets];
                          next[index] = event.target.value;
                          setBullets(next);
                        }}
                        disabled={busy}
                      />
                    </label>
                  ))}
                  {bullets.length < 5 ? (
                    <button
                      type="button"
                      disabled={busy}
                      title="Adds an optional fourth or fifth bullet."
                      onClick={() => setBullets((prev) => [...prev, ""])}
                    >
                      Add Bullet
                    </button>
                  ) : null}
                  <button
                    className="primary"
                    type="button"
                    disabled={busy}
                    title="Starts the four guided reflection questions. AI will not write the message for you."
                    onClick={() => void startThoughtPartnerQuestions()}
                  >
                    Start Reflection Questions
                  </button>
                </>
              ) : null}

              {currentState === "reflection_questions" && thoughtPartnerOutput ? (
                <>
                  <div className="card">
                    <p>
                      <strong>
                        Question {activeQuestionIndex + 1} of {thoughtPartnerOutput.reflectiveQuestions.length}
                      </strong>
                    </p>
                    <p>{currentQuestion}</p>
                    <textarea
                      value={questionAnswers[activeQuestionIndex] ?? ""}
                      onChange={(event) =>
                        setQuestionAnswers((prev) => ({ ...prev, [activeQuestionIndex]: event.target.value }))
                      }
                      disabled={busy}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {activeQuestionIndex < thoughtPartnerOutput.reflectiveQuestions.length - 1 ? (
                      <button
                        className="primary"
                        type="button"
                        disabled={busy}
                        title="Moves to the next reflection question."
                        onClick={continueQuestionFlow}
                      >
                        Next Question
                      </button>
                    ) : (
                      <button
                        className="primary"
                        type="button"
                        disabled={busy || !allQuestionsAnswered}
                        title="Finishes reflection and shows your responses for reference."
                        onClick={() => void finishReflections()}
                      >
                        Finish Reflections
                      </button>
                    )}
                  </div>
                  <div className="stack-sm">
                    {thoughtPartnerOutput.reflectiveQuestions.map((question, index) =>
                      (questionAnswers[index] ?? "").trim().length > 0 ? (
                        <div className="card" key={question}>
                          <p>
                            <strong>Answered Q{index + 1}:</strong> {question}
                          </p>
                          <p>{questionAnswers[index]}</p>
                        </div>
                      ) : null
                    )}
                  </div>
                </>
              ) : null}

              {currentState === "reflection_summary" && thoughtPartnerOutput ? (
                <>
                  <div className="card">
                    <p>
                      <strong>Your Responses</strong>
                    </p>
                    <div className="stack-sm" style={{ marginTop: "0.5rem" }}>
                      {thoughtPartnerOutput.reflectiveQuestions.map((question, index) => (
                        <div key={question} style={{ marginBottom: "0.6rem" }}>
                          <p style={{ fontWeight: 600, fontSize: "0.9em" }}>
                            Q{index + 1}: {question}
                          </p>
                          <p style={{ marginTop: "0.2rem" }}>{questionAnswers[index] ?? ""}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    className="primary"
                    type="button"
                    disabled={busy}
                    title="Closes AI help and moves to independent drafting."
                    onClick={() => void toIndependentDrafting()}
                  >
                    Start Independent Drafting
                  </button>
                </>
              ) : null}

              {(currentState === "independent_drafting" ||
                currentState === "final_edit" ||
                currentState === "post_condition_survey") &&
              thoughtPartnerOutput ? (
                <div className="card" style={{ background: "var(--muted)" }}>
                  <p>
                    <strong>Your Responses</strong>
                  </p>
                  <div className="stack-sm" style={{ marginTop: "0.5rem" }}>
                    {thoughtPartnerOutput.reflectiveQuestions.map((question, index) => (
                      <div key={question} style={{ marginBottom: "0.6rem" }}>
                        <p style={{ fontWeight: 600, fontSize: "0.9em" }}>
                          Q{index + 1}: {question}
                        </p>
                        <p style={{ marginTop: "0.2rem" }}>{questionAnswers[index] ?? ""}</p>
                      </div>
                    ))}
                  </div>
                  <p style={{ marginTop: "0.4rem", color: "var(--muted-foreground)", fontSize: "0.85em" }}>
                    Use this as reference while writing independently.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {aiPanelError ? <p style={{ color: "var(--destructive)", marginTop: "0.5rem" }}>{aiPanelError}</p> : null}
        </section>
      </div>

      {currentState === "post_condition_survey" ? (
        <section ref={surveyRef} className="card">
          <h3>{snapshot.conditionSurveyTemplate.title}</h3>
          <p style={{ color: "black" }}>{snapshot.conditionSurveyTemplate.intro}</p>
          <div style={{ display: "grid", gap: "0.8rem", marginTop: "0.8rem" }}>
            {conditionSurveyItems.map((item) => (
              <SurveyQuestionField
                key={item.id}
                item={item}
                value={conditionSurveyAnswers[item.id]}
                disabled={busy}
                onChange={(next) => setConditionSurveyAnswers((prev) => ({ ...prev, [item.id]: next }))}
              />
            ))}
          </div>
          <div style={{ marginTop: "1rem" }}>
            <button
              className="primary"
              type="button"
              disabled={busy}
              title="Submits the current block and advances to the next step."
              onClick={() => void submitSurveyAndAdvance()}
            >
              Submit Condition + Continue
            </button>
          </div>
          {error ? <p style={{ color: "var(--destructive)", marginTop: "0.5rem" }}>{error}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
