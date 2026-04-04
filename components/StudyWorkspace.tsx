"use client";

import type { SurveyValue } from "@/components/surveys/SurveyQuestionField";
import { getConditionDisplayLabel } from "@/lib/conditionLabels";
import { POST_STUDY_WORKFLOW_OPTIONS } from "@/lib/postStudyWorkflowOptions";
import { PRE_SURVEY_ITEMS, WHEN2MEET_URL, getPreSurveyValidationError, getTodayDateString } from "@/lib/preSurvey";
import { visibleSurveyItems as filterVisibleSurveyItems } from "@/lib/surveyItems";
import { AiAssistantPanel } from "@/components/study/AiAssistantPanel";
import { ConditionSurveySection } from "@/components/study/ConditionSurveySection";
import { MainEditorPanel } from "@/components/study/MainEditorPanel";
import { PostStudySurveySection } from "@/components/study/PostStudySurveySection";
import { PracticeFlow } from "@/components/study/PracticeFlow";
import { StudyContactBar } from "@/components/study/StudyContactBar";
import { StudyHeader } from "@/components/study/StudyHeader";
import type {
  AiActivity,
  EditorHighlightRange,
  PortalMode,
  SessionPayload,
  StudyState,
  Suggestion,
  SurveyItem,
  ThoughtPartnerOutput
} from "@/components/study/types";
import {
  applyReplacementToEditor,
  buildEditorPreviewSegments,
  bulletInputGuidance,
  countWords,
  getPromptText,
  isTrackedEditingKeystroke,
  missingRequiredItems,
  updateEditorHighlightRanges,
  visibleSurveyItems
} from "@/components/study/utils";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
export function StudyWorkspace({
  sessionId,
  portalMode = "researcher"
}: {
  sessionId: string;
  portalMode?: PortalMode;
}) {
  const [snapshot, setSnapshot] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [aiPanelError, setAiPanelError] = useState("");
  const [aiActivity, setAiActivity] = useState<AiActivity>(null);

  const [editorText, setEditorText] = useState("");
  const [bullets, setBullets] = useState<string[]>(["", "", ""]);
  const [hasGeneratedDraft, setHasGeneratedDraft] = useState(false);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionActions, setSuggestionActions] = useState<Record<number, string>>({});
  const [appliedSuggestionText, setAppliedSuggestionText] = useState<Record<number, string>>({});
  const [editorHighlightRanges, setEditorHighlightRanges] = useState<EditorHighlightRange[]>([]);

  const [thoughtPartnerOutput, setThoughtPartnerOutput] = useState<ThoughtPartnerOutput | null>(null);
  const [questionAnswers, setQuestionAnswers] = useState<Record<number, string>>({});
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

  const [conditionSurveyAnswers, setConditionSurveyAnswers] = useState<Record<string, SurveyValue>>({});
  const [postStudyAnswers, setPostStudyAnswers] = useState<Record<string, SurveyValue>>({});
  const [practiceText, setPracticeText] = useState("");
  const [practiceSurveyAnswers, setPracticeSurveyAnswers] = useState<Record<string, SurveyValue>>({});
  const [preSurveyAnswers, setPreSurveyAnswers] = useState<Record<string, SurveyValue>>(() => ({
    pre_today_date: getTodayDateString()
  }));
  const [interviewAvailabilityConfirmed, setInterviewAvailabilityConfirmed] = useState(false);
  const [interviewZoomConfirmed, setInterviewZoomConfirmed] = useState(false);

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
      try {
        const response = await fetch(`/api/session/${sessionId}/log`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trialIndex:
              snapshot.session.currentState === "pre_survey" ||
                snapshot.session.currentState === "practice_intro" ||
                snapshot.session.currentState === "practice_task" ||
                snapshot.session.currentState === "practice_survey"
                ? null
                : snapshot.currentTrial.trial_index,
            eventType,
            payload
          })
        });

        if (!response.ok) {
          console.warn("Telemetry logging failed", {
            eventType,
            status: response.status
          });
        }
      } catch (error) {
        console.warn("Telemetry request failed", {
          eventType,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    },
    [sessionId, snapshot]
  );

  async function transition(
    toState: StudyState,
    payload?: unknown,
    options?: { preEditorMessageText?: string }
  ): Promise<void> {
    await fetchJson(`/api/session/${sessionId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toState,
        payload,
        preEditorMessageText: options?.preEditorMessageText
      })
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
    setAppliedSuggestionText({});
    setEditorHighlightRanges([]);
    setAiPanelError("");
    setAiActivity(null);
    setModifyingId(null);
    setModifyText("");
    setThoughtPartnerOutput(null);
    setQuestionAnswers({});
    setActiveQuestionIndex(0);
    setConditionSurveyAnswers({});
    setPracticeText("");
    setPracticeSurveyAnswers({});
    setPreSurveyAnswers({});
    setInterviewAvailabilityConfirmed(false);
    setInterviewZoomConfirmed(false);
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
    if (snapshot?.currentTrial.condition !== "editor" || snapshot.session.currentState === "ai_revision") {
      return;
    }
    setEditorHighlightRanges((prev) => (prev.length === 0 ? prev : []));
  }, [snapshot?.currentTrial.condition, snapshot?.session.currentState]);

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
      scenarioChecklist: snapshot.currentTrial.scenario.requiredElements ?? []
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
    if (snapshot?.session.currentState !== "pre_survey") {
      return;
    }

    setPreSurveyAnswers((prev) => {
      if (typeof prev.pre_today_date === "string" && prev.pre_today_date.trim()) {
        return prev;
      }

      return {
        ...prev,
        pre_today_date: getTodayDateString()
      };
    });
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

  const wordCount = useMemo(() => countWords(editorText), [editorText]);
  const visiblePreSurveyItems = useMemo(
    () => filterVisibleSurveyItems(PRE_SURVEY_ITEMS, preSurveyAnswers),
    [preSurveyAnswers]
  );
  const isInterviewSelected = preSurveyAnswers.pre_followup_interview === "Yes";

  useEffect(() => {
    if (preSurveyAnswers.pre_followup_interview !== "Yes") {
      setInterviewAvailabilityConfirmed(false);
    }
  }, [preSurveyAnswers.pre_followup_interview]);

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
    if (snapshot?.session.followupInterviewOptIn && !interviewZoomConfirmed) {
      setError("Please confirm that you are with the researcher on Zoom before continuing.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await transition("practice_task");
      setInterviewZoomConfirmed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open practice task");
    } finally {
      setBusy(false);
    }
  }

  async function submitPreSurvey(): Promise<void> {
    const validationError = getPreSurveyValidationError(preSurveyAnswers);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (isInterviewSelected && !interviewAvailabilityConfirmed) {
      setError("Please confirm that you added your availability on When2Meet before continuing.");
      return;
    }

    const responses: Record<string, unknown> = {};
    for (const item of PRE_SURVEY_ITEMS) {
      responses[item.id] = preSurveyAnswers[item.id] ?? null;
    }

    setBusy(true);
    setError("");
    try {
      await fetchJson(`/api/session/${sessionId}/pre-submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses })
      });
      setPreSurveyAnswers({});
      setInterviewAvailabilityConfirmed(false);
      await loadSnapshot();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit pre-survey");
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
      setAiActivity("practice_nudge");
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
      setAiActivity(null);
      setBusy(false);
    }
  }

  async function continueToPracticeSurvey(): Promise<void> {
    if (!practiceText.trim()) {
      setError("Write a short practice reply before continuing.");
      return;
    }
    if (!practiceNudge) {
      setError("Get the AI suggestion in the side panel before continuing to the practice survey.");
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

  function handlePreSurveyChange(itemId: string, next: SurveyValue): void {
    if (itemId === "pre_followup_interview" && next !== "Yes") {
      setInterviewAvailabilityConfirmed(false);
    }

    setPreSurveyAnswers((prev) => ({ ...prev, [itemId]: next }));
  }

  function reflectionPairs(): Array<{ questionOrder: number; question: string; response: string }> {
    const questions = thoughtPartnerOutput?.reflectiveQuestions ?? [];
    return questions.map((question, index) => ({
      questionOrder: index + 1,
      question: question.question,
      response: questionAnswers[index] ?? ""
    }));
  }

  function handleEditorChange(nextText: string): void {
    setEditorText(nextText);
  }

  function handleEditorKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (
      !isTrackedEditingKeystroke({
        key: event.key,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey
      })
    ) {
      return;
    }

    setKeystrokeCount((prev) => prev + 1);

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
      setAiActivity("ghost_writer_generate");
      await transition("ai_generation", { bulletCount: compactBullets.length });
      const json = await fetchJson<{ draft: string }>(`/api/session/${sessionId}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ghost_writer_generate", bullets: compactBullets })
      });
      setEditorText(json.draft);
      setHasGeneratedDraft(true);
      await transition("final_edit", { generated: true }, { preEditorMessageText: json.draft });
    } catch (err) {
      setAiPanelError(err instanceof Error ? err.message : "AI assistant generation failed");
    } finally {
      setAiActivity(null);
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
      setAiActivity("editor_suggest");
      await transition("ai_revision", { messageLength: editorText.length }, { preEditorMessageText: editorText });
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
      setAppliedSuggestionText({});
      setEditorHighlightRanges([]);
    } catch (err) {
      setAiPanelError(err instanceof Error ? err.message : "Failed to get suggestions");
    } finally {
      setAiActivity(null);
      setBusy(false);
    }
  }

  async function applySuggestion(suggestion: Suggestion, action: "accept" | "reject" | "modify", modifiedText?: string): Promise<void> {
    let userModifiedText: string | null = null;
    let appliedText: string | null = null;

    if (action === "accept") {
      const replacement = applyReplacementToEditor(editorText, suggestion.originalSegment, suggestion.suggestedChange);
      if (!replacement) {
        setAiPanelError("Could not apply that suggestion to the current draft. The target sentence was not found.");
        return;
      }
      setEditorText(replacement.nextText);
      appliedText = suggestion.suggestedChange;
      setEditorHighlightRanges((prev) =>
        updateEditorHighlightRanges(prev, {
          suggestionId: suggestion.id,
          matchStart: replacement.matchStart,
          matchEnd: replacement.matchEnd,
          replacementEnd: replacement.replacementEnd,
          status: "accept"
        })
      );
    }

    if (action === "modify") {
      userModifiedText = modifiedText?.trim() ?? "";
      if (!userModifiedText) {
        return;
      }

      const replacement = applyReplacementToEditor(editorText, suggestion.originalSegment, userModifiedText);
      if (!replacement) {
        setAiPanelError("Could not apply that suggestion to the current draft. The target sentence was not found.");
        return;
      }
      setEditorText(replacement.nextText);
      appliedText = userModifiedText;
      setEditorHighlightRanges((prev) =>
        updateEditorHighlightRanges(prev, {
          suggestionId: suggestion.id,
          matchStart: replacement.matchStart,
          matchEnd: replacement.matchEnd,
          replacementEnd: replacement.replacementEnd,
          status: "modify"
        })
      );
    }

    setAiPanelError("");
    setSuggestionActions((prev) => ({ ...prev, [suggestion.id]: action }));
    if (appliedText !== null) {
      setAppliedSuggestionText((prev) => ({ ...prev, [suggestion.id]: appliedText }));
    }
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
      setAiActivity("thought_partner_questions");
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
      setAiActivity(null);
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

  async function completeThoughtPartnerDraft(): Promise<void> {
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

  const editorPreviewSegments = useMemo(
    () => buildEditorPreviewSegments(editorText, editorHighlightRanges),
    [editorHighlightRanges, editorText]
  );

  const currentQuestion = thoughtPartnerOutput?.reflectiveQuestions[activeQuestionIndex];
  const allQuestionsAnswered =
    thoughtPartnerOutput?.reflectiveQuestions.every((_, index) => (questionAnswers[index] ?? "").trim().length > 0) ?? false;
  const isPracticeAiLoading = aiActivity === "practice_nudge";
  const isGhostWriterGenerating = aiActivity === "ghost_writer_generate";
  const isEditorGenerating = aiActivity === "editor_suggest";
  const isThoughtPartnerGenerating = aiActivity === "thought_partner_questions";
  const showAiLoadingCard =
    isPracticeAiLoading ||
    isGhostWriterGenerating ||
    isEditorGenerating ||
    isThoughtPartnerGenerating;

  const aiLoadingCopy = useMemo(() => {
    switch (aiActivity) {
      case "practice_nudge":
        return {
          eyebrow: "AI is replying",
          title: "Building a quick practice suggestion",
          detail: "The side panel will update with a sample reply in a moment."
        };
      case "ghost_writer_generate":
        return {
          eyebrow: `${getConditionDisplayLabel("ghost_writer")} is drafting`,
          title: `${getConditionDisplayLabel("ghost_writer")} is turning your bullets into a full message`,
          detail: "A single draft is being composed from the points you provided."
        };
      case "editor_suggest":
        return {
          eyebrow: `${getConditionDisplayLabel("editor")} is reviewing`,
          title: "Preparing revision suggestions",
          detail: "Revision suggestions will appear as editable cards in a moment."
        };
      case "thought_partner_questions":
        return {
          eyebrow: `${getConditionDisplayLabel("thought_partner")} is getting ready`,
          title: "Preparing brainstorm questions",
          detail: "The first question will appear here as soon as the prompt is ready."
        };
      default:
        return null;
    }
  }, [aiActivity]);

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
          {snapshot.session.followupInterviewOptIn ? (
            <p style={{ color: "black" }}>Please inform the researcher that you are done and ready for the interview.</p>
          ) : null}
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
  const guidance = bulletInputGuidance(condition);

  if (currentState === "inter_condition_buffer") {
    const completedRound = Math.max(1, snapshot.currentTrial.order_position - 1);

    return (
      <>
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
        {portalMode === "participant" ? <StudyContactBar /> : null}
      </>
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
                  "Rank the three writing workflows from most to least preferred based on your overall experience.",
                options: POST_STUDY_WORKFLOW_OPTIONS
              }
              : item.id === "overall_preference_rationale"
                ? {
                  ...item,
                  prompt: "What about your experience led you to rank them this way? (1-5 sentences)",
                  required: true
                }
              : item
          )
        }
        : snapshot.postStudySurveyTemplate;

    const finalItems = visibleSurveyItems(finalTemplate, postStudyAnswers);

    return (
      <>
        <PostStudySurveySection
          template={finalTemplate}
          items={finalItems}
          answers={postStudyAnswers}
          busy={busy}
          error={error}
          onChange={(itemId, next) => setPostStudyAnswers((prev) => ({ ...prev, [itemId]: next }))}
          onSubmit={() => void submitPostStudySurvey()}
        />
        {portalMode === "participant" ? <StudyContactBar /> : null}
      </>
    );
  }

  const conditionSurveyItems = visibleSurveyItems(snapshot.conditionSurveyTemplate, conditionSurveyAnswers, condition);

  if (currentState === "pre_survey" || currentState === "practice_intro" || currentState === "practice_task" || currentState === "practice_survey") {
    return (
      <PracticeFlow
        portalMode={portalMode}
        sessionId={snapshot.session.id}
        participantLabel={snapshot.session.participantLabel}
        accessCode={snapshot.session.accessCode}
        currentState={currentState}
        busy={busy}
        error={error}
        isInterviewSelected={isInterviewSelected}
        isInterviewParticipant={snapshot.session.followupInterviewOptIn}
        when2MeetUrl={WHEN2MEET_URL}
        interviewAvailabilityConfirmed={interviewAvailabilityConfirmed}
        interviewZoomConfirmed={interviewZoomConfirmed}
        preSurveyItems={visiblePreSurveyItems}
        preSurveyAnswers={preSurveyAnswers}
        practiceSurveyItems={PRACTICE_SURVEY_ITEMS}
        practiceSurveyAnswers={practiceSurveyAnswers}
        practiceText={practiceText}
        practiceNudgeRequested={practiceNudgeRequested}
        practiceNudge={practiceNudge}
        aiLoadingCopy={aiLoadingCopy}
        isPracticeAiLoading={isPracticeAiLoading}
        onPreSurveyChange={handlePreSurveyChange}
        onInterviewAvailabilityConfirmedChange={setInterviewAvailabilityConfirmed}
        onInterviewZoomConfirmedChange={setInterviewZoomConfirmed}
        onPracticeSurveyChange={(itemId, next) => setPracticeSurveyAnswers((prev) => ({ ...prev, [itemId]: next }))}
        onPracticeTextChange={setPracticeText}
        onSubmitPreSurvey={() => void submitPreSurvey()}
        onStartPracticeTask={() => void startPracticeTask()}
        onContinueToPracticeSurvey={() => void continueToPracticeSurvey()}
        onRequestPracticeNudge={() => void requestPracticeNudge()}
        onSubmitPracticeRound={() => void submitPracticeRound()}
        practiceWordCount={countWords(practiceText)}
      />
    );
  }

  const statusColors: Record<string, string> = {
    accept: "#16a34a",
    modify: "#d97706",
    reject: "#dc2626",
    pending: "#6b7280"
  };
  const statusLabels: Record<string, string> = {
    accept: "Updated",
    modify: "Updated w/ Edit",
    reject: "Rejected",
    pending: "Not responded"
  };

  return (
    <>
      <div className="layout-grid">
        <StudyHeader
          portalMode={portalMode}
          snapshot={snapshot}
          currentState={currentState}
        />

        <div className="workspace-grid">
          <MainEditorPanel
            snapshot={snapshot}
            condition={condition}
            currentState={currentState}
            editorText={editorText}
            editorEnabled={editorEnabled}
            busy={busy}
            isEditorGenerating={isEditorGenerating}
            isGhostWriterGenerating={isGhostWriterGenerating}
            editorPreviewSegments={editorPreviewSegments}
            wordCount={wordCount}
            error={error}
            onEditorChange={handleEditorChange}
            onEditorKeyDown={handleEditorKeyDown}
            onStartConditionFlow={() => void startConditionFlow()}
            onCompleteThoughtPartnerDraft={() => void completeThoughtPartnerDraft()}
            onToFinalEdit={() => void toFinalEdit()}
            onToSurvey={() => void toSurvey()}
          />

          <AiAssistantPanel
            condition={condition}
            currentState={currentState}
            promptText={getPromptText(condition, currentState)}
            aiPanelError={aiPanelError}
            showAiLoadingCard={showAiLoadingCard}
            aiLoadingCopy={aiLoadingCopy}
            guidance={guidance}
            bullets={bullets}
            busy={busy}
            hasGeneratedDraft={hasGeneratedDraft}
            editorText={editorText}
            isGhostWriterGenerating={isGhostWriterGenerating}
            isEditorGenerating={isEditorGenerating}
            isThoughtPartnerGenerating={isThoughtPartnerGenerating}
            suggestions={suggestions}
            suggestionActions={suggestionActions}
            appliedSuggestionText={appliedSuggestionText}
            modifyingId={modifyingId}
            modifyText={modifyText}
            statusColors={statusColors}
            statusLabels={statusLabels}
            thoughtPartnerOutput={thoughtPartnerOutput}
            activeQuestionIndex={activeQuestionIndex}
            currentQuestion={currentQuestion}
            questionAnswers={questionAnswers}
            allQuestionsAnswered={allQuestionsAnswered}
            onBulletsChange={setBullets}
            onRunGhostWriterGenerate={() => void runGhostWriterGenerate()}
            onRunEditorSuggestions={() => void runEditorSuggestions()}
            onApplySuggestion={(suggestion, action, modifiedText) => {
              void applySuggestion(suggestion, action, modifiedText);
              if (action === "modify") {
                setModifyingId(null);
                setModifyText("");
              }
            }}
            onStartModify={(suggestionId, suggestedChange) => {
              setModifyingId(suggestionId);
              setModifyText(suggestedChange);
            }}
            onModifyTextChange={setModifyText}
            onCancelModify={() => {
              setModifyingId(null);
              setModifyText("");
            }}
            onToFinalEdit={() => void toFinalEdit()}
            onStartThoughtPartnerQuestions={() => void startThoughtPartnerQuestions()}
            onContinueQuestionFlow={continueQuestionFlow}
            onQuestionAnswerChange={(index, nextText) =>
              setQuestionAnswers((prev) => ({ ...prev, [index]: nextText }))
            }
            onFinishReflections={() => void finishReflections()}
            onToIndependentDrafting={() => void toIndependentDrafting()}
          />
        </div>

        {currentState === "post_condition_survey" ? (
          <ConditionSurveySection
            surveyRef={surveyRef}
            template={snapshot.conditionSurveyTemplate}
            items={conditionSurveyItems}
            answers={conditionSurveyAnswers}
            busy={busy}
            error={error}
            onChange={(itemId, next) => setConditionSurveyAnswers((prev) => ({ ...prev, [itemId]: next }))}
            onSubmit={() => void submitSurveyAndAdvance()}
          />
        ) : null}
      </div>
      {portalMode === "participant" ? <StudyContactBar /> : null}
    </>
  );
}
