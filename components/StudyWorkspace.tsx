"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Condition = "drafter" | "revisor" | "facilitator";
type StudyState =
  | "scenario_intro"
  | "bullet_input"
  | "human_drafting"
  | "ai_generation"
  | "ai_revision"
  | "reflection_questions"
  | "reflection_summary"
  | "independent_drafting"
  | "optional_feedback"
  | "final_edit"
  | "post_condition_survey"
  | "inter_condition_buffer";

type SessionPayload = {
  session: {
    id: string;
    participantId: string;
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
};

type Suggestion = {
  id: number;
  originalSegment: string;
  suggestedChange: string;
  reasonTag: "tone" | "clarity" | "empathy";
};

type FacilitatorOutput = {
  reflectiveQuestions: string[];
  summary: string;
  inferredRecipientPerspective: string;
  emotionalGoal: string;
  thingsToAvoid: string[];
  concreteNextStep: string;
  reminderChecklist: string[];
  highLevelFeedback?: string[];
};

const SPMA_ITEMS = [
  "This message feels like it reflects my own voice.",
  "I feel psychological ownership over the final message.",
  "The final message expresses what I genuinely wanted to say.",
  "I would describe this message as personally authentic.",
  "I feel the message represents me, not the AI."
];

function getPromptText(condition: Condition, state: StudyState): string {
  const prompts: Record<Condition, Partial<Record<StudyState, string>>> = {
    drafter: {
      scenario_intro: "Read scenario context, then begin condition.",
      bullet_input: "Enter 3-5 bullets before one-time draft generation.",
      ai_generation: "Generate a single AI draft from provided bullets only.",
      final_edit: "Edit the generated draft freely before survey."
    },
    revisor: {
      scenario_intro: "Read scenario context, then begin condition.",
      human_drafting: "Write a full message without AI drafting help.",
      ai_revision: "Review structured tone/clarity/empathy suggestions and accept/reject/modify.",
      final_edit: "Finalize edits before survey."
    },
    facilitator: {
      scenario_intro: "Read scenario context, then begin condition.",
      bullet_input: "Enter situation bullets for reflective facilitation.",
      reflection_questions: "Answer facilitator reflection questions.",
      reflection_summary: "Review planning summary and checklist.",
      independent_drafting: "Write the final message independently.",
      optional_feedback: "Review optional high-level feedback only.",
      final_edit: "Finalize edits before survey."
    }
  };

  return prompts[condition][state] ?? "Follow state instructions in the interface.";
}

export function StudyWorkspace({ sessionId }: { sessionId: string }) {
  const [snapshot, setSnapshot] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [editorText, setEditorText] = useState("");
  const [bullets, setBullets] = useState<string[]>(["", "", ""]);
  const [hasGeneratedDraft, setHasGeneratedDraft] = useState(false);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionActions, setSuggestionActions] = useState<Record<number, string>>({});

  const [facilitatorOutput, setFacilitatorOutput] = useState<FacilitatorOutput | null>(null);
  const [questionAnswers, setQuestionAnswers] = useState<Record<number, string>>({});

  const [surveyScale, setSurveyScale] = useState<Record<string, number>>({});
  const [surveyComment, setSurveyComment] = useState("");

  const seenPromptKeys = useRef<Set<string>>(new Set());
  const [clock, setClock] = useState(Date.now());
  const trialIdentity = snapshot
    ? `${snapshot.session.id}:${snapshot.currentTrial.trial_index}`
    : "uninitialized";

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
          trialIndex: snapshot.currentTrial.trial_index,
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
    setFacilitatorOutput(null);
    setQuestionAnswers({});
    setSurveyScale({});
    setSurveyComment("");
    seenPromptKeys.current.clear();
  }, [trialIdentity]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!snapshot) {
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
    if (!snapshot) {
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
    if (!snapshot) {
      return;
    }

    const startedAt = snapshot.currentTrial.started_at;
    const state = snapshot.session.currentState;
    const handle = window.setInterval(() => {
      const elapsedSec = startedAt
        ? Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
        : 0;
      void logEvent("timer_heartbeat", {
        elapsedSec,
        state
      });
    }, 30000);

    return () => window.clearInterval(handle);
  }, [
    logEvent,
    snapshot,
    snapshot?.session.id,
    snapshot?.currentTrial.trial_index,
    snapshot?.session.currentState,
    snapshot?.currentTrial.started_at
  ]);

  const elapsedSeconds = useMemo(() => {
    if (!snapshot?.currentTrial.started_at) {
      return 0;
    }
    return Math.max(
      0,
      Math.floor((clock - new Date(snapshot.currentTrial.started_at).getTime()) / 1000)
    );
  }, [clock, snapshot]);

  const conditionLabel = snapshot?.currentTrial.condition.toUpperCase();

  async function startConditionFlow(): Promise<void> {
    if (!snapshot) {
      return;
    }
    const toState = snapshot.currentTrial.condition === "revisor" ? "human_drafting" : "bullet_input";
    setBusy(true);
    setError("");
    try {
      await transition(toState);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start condition");
    } finally {
      setBusy(false);
    }
  }

  async function runDrafterGenerate(): Promise<void> {
    if (!snapshot) {
      return;
    }
    const compactBullets = bullets.map((item) => item.trim()).filter(Boolean);
    if (compactBullets.length < 3 || compactBullets.length > 5) {
      setError("Drafter requires 3-5 bullet points.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await transition("ai_generation", { bulletCount: compactBullets.length });
      const json = await fetchJson<{ draft: string }>(`/api/session/${sessionId}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "drafter_generate", bullets: compactBullets })
      });
      setEditorText(json.draft);
      setHasGeneratedDraft(true);
      await transition("final_edit", { generated: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draft generation failed");
    } finally {
      setBusy(false);
    }
  }

  async function runRevisorSuggestions(): Promise<void> {
    if (!snapshot) {
      return;
    }
    if (!editorText.trim()) {
      setError("Write a full message before requesting revision suggestions.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await transition("ai_revision", { messageLength: editorText.length });
      const json = await fetchJson<{ suggestions: Suggestion[] }>(
        `/api/session/${sessionId}/ai`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "revisor_suggest", message: editorText })
        }
      );

      setSuggestions(json.suggestions);
      const actions: Record<number, string> = {};
      json.suggestions.forEach((item) => {
        actions[item.id] = "pending";
      });
      setSuggestionActions(actions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get suggestions");
    } finally {
      setBusy(false);
    }
  }

  async function applySuggestion(suggestion: Suggestion, action: "accept" | "reject" | "modify"): Promise<void> {
    let nextText = editorText;
    let userModifiedText: string | null = null;

    if (action === "accept") {
      if (editorText.includes(suggestion.originalSegment)) {
        nextText = editorText.replace(suggestion.originalSegment, suggestion.suggestedChange);
      } else {
        nextText = `${editorText}\n\n[Applied revision]\n${suggestion.suggestedChange}`;
      }
      setEditorText(nextText);
    }

    if (action === "modify") {
      userModifiedText =
        window.prompt("Enter your modified version of this suggestion:", suggestion.suggestedChange) ?? "";
      if (!userModifiedText.trim()) {
        return;
      }
      if (editorText.includes(suggestion.originalSegment)) {
        nextText = editorText.replace(suggestion.originalSegment, userModifiedText);
      } else {
        nextText = `${editorText}\n\n[Modified revision]\n${userModifiedText}`;
      }
      setEditorText(nextText);
    }

    setSuggestionActions((prev) => ({ ...prev, [suggestion.id]: action }));
    await fetchJson(`/api/session/${sessionId}/revisor-action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        suggestionId: suggestion.id,
        actionStatus: action,
        userModifiedText
      })
    });
  }

  async function startFacilitatorQuestions(): Promise<void> {
    const compactBullets = bullets.map((item) => item.trim()).filter(Boolean);
    if (compactBullets.length < 3) {
      setError("Facilitator requires at least 3 bullet points.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await transition("reflection_questions", { bulletCount: compactBullets.length });
      const json = await fetchJson<{ facilitator: FacilitatorOutput }>(`/api/session/${sessionId}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "facilitator_questions",
          bullets: compactBullets
        })
      });
      setFacilitatorOutput(json.facilitator);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to ask reflection questions");
    } finally {
      setBusy(false);
    }
  }

  function reflectionPairs(): Array<{ question: string; response: string }> {
    const questions = facilitatorOutput?.reflectiveQuestions ?? [];
    return questions
      .map((question, idx) => ({ question, response: questionAnswers[idx] ?? "" }))
      .filter((pair) => pair.response.trim().length > 0);
  }

  async function summarizeReflections(): Promise<void> {
    const compactBullets = bullets.map((item) => item.trim()).filter(Boolean);
    const reflections = reflectionPairs();
    if (!reflections.length) {
      setError("Answer at least one reflection question before summary.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await transition("reflection_summary", { reflectionCount: reflections.length });
      const json = await fetchJson<{ facilitator: FacilitatorOutput }>(`/api/session/${sessionId}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "facilitator_summary",
          bullets: compactBullets,
          reflections
        })
      });
      setFacilitatorOutput(json.facilitator);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to summarize reflections");
    } finally {
      setBusy(false);
    }
  }

  async function requestOptionalFeedback(): Promise<void> {
    const compactBullets = bullets.map((item) => item.trim()).filter(Boolean);
    setBusy(true);
    setError("");
    try {
      await transition("optional_feedback");
      const json = await fetchJson<{ facilitator: FacilitatorOutput }>(`/api/session/${sessionId}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "facilitator_feedback",
          bullets: compactBullets,
          reflections: reflectionPairs(),
          draftMessage: editorText
        })
      });
      setFacilitatorOutput(json.facilitator);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get optional feedback");
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

    const surveyResponses: Record<string, unknown> = {
      spma: SPMA_ITEMS.map((_item, index) => surveyScale[`spma_${index}`] ?? null),
      effort_1: surveyScale.effort_1 ?? null,
      effort_2: surveyScale.effort_2 ?? null,
      effort_3: surveyScale.effort_3 ?? null,
      willingness_to_send: surveyScale.willingness ?? null,
      open_comment: surveyComment
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
          revisorActions: suggestionActions,
          facilitatorResponses: reflectionPairs()
        })
      });
      await loadSnapshot();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  const editorEnabled = useMemo(() => {
    if (!snapshot) {
      return false;
    }
    const state = snapshot.session.currentState;
    if (state === "human_drafting" || state === "ai_revision" || state === "final_edit" || state === "post_condition_survey") {
      return true;
    }
    if (state === "independent_drafting" || state === "optional_feedback") {
      return true;
    }
    return false;
  }, [snapshot]);

  if (loading) {
    return <div className="card">Loading session...</div>;
  }

  if (error && !snapshot) {
    return (
      <div className="card">
        <p>{error}</p>
        <Link href="/researcher">Back to researcher panel</Link>
      </div>
    );
  }

  if (!snapshot) {
    return <div className="card">Session unavailable.</div>;
  }

  if (snapshot.session.status === "completed") {
    return (
      <div className="card">
        <h1>Session Complete</h1>
        <p>Participant: {snapshot.session.participantId}</p>
        <p>All condition trials are complete and logged.</p>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <Link href="/researcher">
            <button type="button">Back to Control Panel</button>
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

  return (
    <div className="layout-grid">
      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <strong>Session:</strong> {snapshot.session.id.slice(0, 8)} | <strong>Participant:</strong>{" "}
            {snapshot.session.participantId}
          </div>
          <div>
            <span className="tag">Condition: {conditionLabel}</span>{" "}
            <span className="tag">State: {currentState}</span>{" "}
            <span className="tag">Elapsed: {elapsedSeconds}s</span>
          </div>
        </div>

        <div style={{ marginTop: "0.7rem", display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          {snapshot.allTrials.map((trial) => (
            <span key={trial.trial_index} className="tag">
              T{trial.trial_index + 1} {trial.scenario_id}/{trial.condition}/{trial.status}
            </span>
          ))}
        </div>
      </section>

      <div className="workspace-grid">
        <section className="card">
          <h2>{snapshot.currentTrial.scenario.title}</h2>
          <p style={{ color: "var(--muted)" }}>{snapshot.currentTrial.scenario.description}</p>

          <h3>Required Message Elements</h3>
          <ul>
            {snapshot.currentTrial.scenario.requiredElements.map((element) => (
              <li key={element}>{element}</li>
            ))}
          </ul>

          <h3>Main Editor</h3>
          <textarea
            value={editorText}
            onChange={(event) => setEditorText(event.target.value)}
            placeholder="Write or edit your message here..."
            disabled={!editorEnabled || busy}
            style={{ minHeight: "260px" }}
          />

          <div style={{ marginTop: "0.7rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            {currentState === "scenario_intro" ? (
              <button className="primary" disabled={busy} onClick={() => void startConditionFlow()}>
                Start Condition
              </button>
            ) : null}

            {currentState === "final_edit" ? (
              <button className="primary" disabled={busy} onClick={() => void toSurvey()}>
                Continue to Post-Condition Survey
              </button>
            ) : null}

            {currentState === "post_condition_survey" ? (
              <button className="primary" disabled={busy} onClick={() => void submitSurveyAndAdvance()}>
                Submit Condition + Advance
              </button>
            ) : null}
          </div>

          {error ? <p style={{ color: "var(--warn)" }}>{error}</p> : null}
        </section>

        <section className="card">
          <h2>AI Side Panel</h2>

          {condition === "drafter" ? (
            <div style={{ display: "grid", gap: "0.7rem" }}>
              <p style={{ color: "var(--muted)" }}>
                Drafter flow: bullet input first, one generation, then free editing.
              </p>
              {(currentState === "bullet_input" || currentState === "ai_generation") && (
                <>
                  {bullets.map((value, idx) => (
                    <label key={idx}>
                      Bullet {idx + 1}
                      <input
                        value={value}
                        onChange={(event) => {
                          const next = [...bullets];
                          next[idx] = event.target.value;
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
                      onClick={() => setBullets((prev) => [...prev, ""])}
                    >
                      Add Bullet
                    </button>
                  ) : null}

                  <button
                    className="primary"
                    type="button"
                    disabled={busy || hasGeneratedDraft}
                    onClick={() => void runDrafterGenerate()}
                  >
                    Generate Draft
                  </button>
                </>
              )}
              {hasGeneratedDraft ? <p>Draft generated. You may now edit in the main editor.</p> : null}
            </div>
          ) : null}

          {condition === "revisor" ? (
            <div style={{ display: "grid", gap: "0.7rem" }}>
              <p style={{ color: "var(--muted)" }}>
                Revisor flow: write alone first, request structured revision suggestions, then
                accept/reject/modify.
              </p>

              {currentState === "human_drafting" ? (
                <button className="primary" type="button" disabled={busy} onClick={() => void runRevisorSuggestions()}>
                  Get Revision Suggestions
                </button>
              ) : null}

              {currentState === "ai_revision" ? (
                <>
                  {suggestions.length === 0 ? <p>No suggestions yet.</p> : null}
                  {suggestions.map((suggestion) => (
                    <div className="card" key={suggestion.id}>
                      <p>
                        <strong>Original:</strong> {suggestion.originalSegment}
                      </p>
                      <p>
                        <strong>Suggested:</strong> {suggestion.suggestedChange}
                      </p>
                      <p>
                        <strong>Reason:</strong> {suggestion.reasonTag}
                      </p>
                      <p>
                        <strong>Status:</strong> {suggestionActions[suggestion.id] ?? "pending"}
                      </p>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <button type="button" onClick={() => void applySuggestion(suggestion, "accept")}>
                          Accept
                        </button>
                        <button type="button" onClick={() => void applySuggestion(suggestion, "modify")}>
                          Modify
                        </button>
                        <button type="button" onClick={() => void applySuggestion(suggestion, "reject")}>
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}

                  <button className="primary" type="button" onClick={() => void toFinalEdit()}>
                    Continue to Final Edit
                  </button>
                </>
              ) : null}
            </div>
          ) : null}

          {condition === "facilitator" ? (
            <div style={{ display: "grid", gap: "0.7rem" }}>
              <p style={{ color: "var(--muted)" }}>
                Facilitator flow: reflective Q&amp;A and planning support only, then independent
                drafting.
              </p>

              {currentState === "bullet_input" ? (
                <>
                  {bullets.map((value, idx) => (
                    <label key={idx}>
                      Situation Bullet {idx + 1}
                      <input
                        value={value}
                        onChange={(event) => {
                          const next = [...bullets];
                          next[idx] = event.target.value;
                          setBullets(next);
                        }}
                        disabled={busy}
                      />
                    </label>
                  ))}

                  {bullets.length < 5 ? (
                    <button type="button" onClick={() => setBullets((prev) => [...prev, ""])}>
                      Add Bullet
                    </button>
                  ) : null}

                  <button className="primary" type="button" disabled={busy} onClick={() => void startFacilitatorQuestions()}>
                    Start Reflection Questions
                  </button>
                </>
              ) : null}

              {currentState === "reflection_questions" ? (
                <>
                  {facilitatorOutput?.reflectiveQuestions?.map((question, idx) => (
                    <label key={question}>
                      Q{idx + 1}. {question}
                      <textarea
                        value={questionAnswers[idx] ?? ""}
                        onChange={(event) =>
                          setQuestionAnswers((prev) => ({ ...prev, [idx]: event.target.value }))
                        }
                        disabled={busy}
                      />
                    </label>
                  ))}

                  <button className="primary" type="button" disabled={busy} onClick={() => void summarizeReflections()}>
                    Generate Reflection Summary
                  </button>
                </>
              ) : null}

              {currentState === "reflection_summary" ? (
                <>
                  {facilitatorOutput ? (
                    <>
                      <p>
                        <strong>Recipient perspective:</strong>{" "}
                        {facilitatorOutput.inferredRecipientPerspective}
                      </p>
                      <p>
                        <strong>Emotional goal:</strong> {facilitatorOutput.emotionalGoal}
                      </p>
                      <p>
                        <strong>Summary:</strong> {facilitatorOutput.summary}
                      </p>
                      <p>
                        <strong>Things to avoid:</strong> {facilitatorOutput.thingsToAvoid.join(", ")}
                      </p>
                      <p>
                        <strong>Concrete next step:</strong> {facilitatorOutput.concreteNextStep}
                      </p>
                      <ul>
                        {facilitatorOutput.reminderChecklist.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}

                  <button className="primary" type="button" disabled={busy} onClick={() => void transition("independent_drafting")}>
                    Continue to Independent Drafting
                  </button>
                </>
              ) : null}

              {currentState === "independent_drafting" ? (
                <>
                  <p>Write your message in the main editor.</p>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button className="primary" type="button" disabled={busy} onClick={() => void requestOptionalFeedback()}>
                      Get Optional High-Level Feedback
                    </button>
                    <button type="button" disabled={busy} onClick={() => void toFinalEdit()}>
                      Skip Feedback and Continue
                    </button>
                  </div>
                </>
              ) : null}

              {currentState === "optional_feedback" ? (
                <>
                  <p>
                    <strong>High-level feedback only:</strong>
                  </p>
                  <ul>
                    {(facilitatorOutput?.highLevelFeedback ?? []).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <button className="primary" type="button" onClick={() => void toFinalEdit()}>
                    Continue to Final Edit
                  </button>
                </>
              ) : null}
            </div>
          ) : null}

          {currentState === "post_condition_survey" ? (
            <div className="card" style={{ marginTop: "0.8rem" }}>
              <h3>Post-Condition Survey</h3>
              <p style={{ color: "var(--muted)" }}>
                Items are recorded immediately for manipulation checks and main outcomes.
              </p>

              {SPMA_ITEMS.map((item, idx) => (
                <label key={item}>
                  SPMA {idx + 1}: {item}
                  <select
                    value={surveyScale[`spma_${idx}`] ?? ""}
                    onChange={(event) =>
                      setSurveyScale((prev) => ({ ...prev, [`spma_${idx}`]: Number(event.target.value) }))
                    }
                  >
                    <option value="">Select</option>
                    {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                      <option key={num} value={num}>
                        {num}
                      </option>
                    ))}
                  </select>
                </label>
              ))}

              <label>
                Effort Item 1 (mental demand)
                <select
                  value={surveyScale.effort_1 ?? ""}
                  onChange={(event) =>
                    setSurveyScale((prev) => ({ ...prev, effort_1: Number(event.target.value) }))
                  }
                >
                  <option value="">Select</option>
                  {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Effort Item 2 (effort required)
                <select
                  value={surveyScale.effort_2 ?? ""}
                  onChange={(event) =>
                    setSurveyScale((prev) => ({ ...prev, effort_2: Number(event.target.value) }))
                  }
                >
                  <option value="">Select</option>
                  {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Effort Item 3 (difficulty)
                <select
                  value={surveyScale.effort_3 ?? ""}
                  onChange={(event) =>
                    setSurveyScale((prev) => ({ ...prev, effort_3: Number(event.target.value) }))
                  }
                >
                  <option value="">Select</option>
                  {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Willingness to send this message
                <select
                  value={surveyScale.willingness ?? ""}
                  onChange={(event) =>
                    setSurveyScale((prev) => ({ ...prev, willingness: Number(event.target.value) }))
                  }
                >
                  <option value="">Select</option>
                  {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Open comment
                <textarea
                  value={surveyComment}
                  onChange={(event) => setSurveyComment(event.target.value)}
                />
              </label>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
