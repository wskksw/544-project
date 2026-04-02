"use client";

import type {
  AiLoadingCopy,
  BulletInputGuidance,
  Condition,
  Suggestion,
  StudyState,
  ThoughtPartnerOutput
} from "@/components/study/types";
import { getConditionDisplayLabel } from "@/lib/conditionLabels";
import { splitBoldText } from "@/components/study/utils";

export function AiAssistantPanel({
  condition,
  currentState,
  promptText,
  aiPanelError,
  showAiLoadingCard,
  aiLoadingCopy,
  guidance,
  bullets,
  busy,
  hasGeneratedDraft,
  editorText,
  isGhostWriterGenerating,
  isEditorGenerating,
  isThoughtPartnerGenerating,
  suggestions,
  suggestionActions,
  appliedSuggestionText,
  modifyingId,
  modifyText,
  statusColors,
  statusLabels,
  thoughtPartnerOutput,
  activeQuestionIndex,
  currentQuestion,
  questionAnswers,
  allQuestionsAnswered,
  onBulletsChange,
  onRunGhostWriterGenerate,
  onRunEditorSuggestions,
  onApplySuggestion,
  onStartModify,
  onModifyTextChange,
  onCancelModify,
  onToFinalEdit,
  onStartThoughtPartnerQuestions,
  onContinueQuestionFlow,
  onQuestionAnswerChange,
  onFinishReflections,
  onToIndependentDrafting
}: {
  condition: Condition;
  currentState: StudyState;
  promptText: string;
  aiPanelError: string;
  showAiLoadingCard: boolean;
  aiLoadingCopy: AiLoadingCopy | null;
  guidance: BulletInputGuidance;
  bullets: string[];
  busy: boolean;
  hasGeneratedDraft: boolean;
  editorText: string;
  isGhostWriterGenerating: boolean;
  isEditorGenerating: boolean;
  isThoughtPartnerGenerating: boolean;
  suggestions: Suggestion[];
  suggestionActions: Record<number, string>;
  appliedSuggestionText: Record<number, string>;
  modifyingId: number | null;
  modifyText: string;
  statusColors: Record<string, string>;
  statusLabels: Record<string, string>;
  thoughtPartnerOutput: ThoughtPartnerOutput | null;
  activeQuestionIndex: number;
  currentQuestion: ThoughtPartnerOutput["reflectiveQuestions"][number] | undefined;
  questionAnswers: Record<number, string>;
  allQuestionsAnswered: boolean;
  onBulletsChange: (updater: (prev: string[]) => string[]) => void;
  onRunGhostWriterGenerate: () => void;
  onRunEditorSuggestions: () => void;
  onApplySuggestion: (suggestion: Suggestion, action: "accept" | "reject" | "modify", modifiedText?: string) => void;
  onStartModify: (suggestionId: number, suggestedChange: string) => void;
  onModifyTextChange: (nextText: string) => void;
  onCancelModify: () => void;
  onToFinalEdit: () => void;
  onStartThoughtPartnerQuestions: () => void;
  onContinueQuestionFlow: () => void;
  onQuestionAnswerChange: (index: number, nextText: string) => void;
  onFinishReflections: () => void;
  onToIndependentDrafting: () => void;
}) {
  const allSuggestionsActioned =
    suggestions.length > 0 && Object.values(suggestionActions).every((action) => action !== "pending");
  const promptSegments = splitBoldText(promptText);
  const assistantLabel = getConditionDisplayLabel(condition);

  return (
    <section className="card">
      <h2>{assistantLabel}</h2>
      <p style={{ color: "black" }}>
        {promptSegments.map((segment, index) =>
          segment.bold ? <strong key={`${segment.text}-${index}`}>{segment.text}</strong> : segment.text
        )}
      </p>
      {aiPanelError ? <p style={{ color: "var(--destructive)", marginTop: "0.3rem" }}>{aiPanelError}</p> : null}
      {showAiLoadingCard && aiLoadingCopy ? (
        <div className="ai-status-card" style={{ marginTop: "0.6rem" }} aria-live="polite" aria-busy="true">
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

      {(currentState === "bullet_input" || currentState === "human_drafting") &&
      (guidance.whatAiDoes.length > 0 || guidance.showExample) ? (
        <div className="card" style={{ marginTop: "0.6rem", background: "var(--muted)" }}>
          {guidance.whatAiDoes.length > 0 ? (
            <>
              <p style={{ fontWeight: 600 }}>What AI will do next</p>
              <ul style={{ marginTop: "0.4rem", paddingLeft: "1.2rem" }}>
                {guidance.whatAiDoes.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </>
          ) : null}

          {guidance.showExample ? (
            <details style={{ marginTop: "0.6rem" }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>See example</summary>
              <p style={{ marginTop: "0.45rem", fontSize: "0.9em", color: "var(--muted-foreground)" }}>{guidance.exampleTitle}</p>
              <ul style={{ marginTop: "0.3rem", paddingLeft: "1.2rem" }}>
                {guidance.exampleBullets.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}

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
                    onChange={(event) =>
                      onBulletsChange((prev) => prev.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))
                    }
                    disabled={busy || hasGeneratedDraft}
                  />
                </label>
              ))}
              {bullets.length < 5 ? (
                <button
                  type="button"
                  disabled={busy || hasGeneratedDraft}
                  title="Adds an optional fourth or fifth bullet before generation."
                  onClick={() => onBulletsChange((prev) => [...prev, ""])}
                >
                  Add Bullet
                </button>
              ) : null}
              <button
                className="primary"
                type="button"
                disabled={busy || hasGeneratedDraft}
                title={guidance.tooltip}
                onClick={onRunGhostWriterGenerate}
              >
                {isGhostWriterGenerating ? "Generating…" : "Generate Draft"}
              </button>
            </>
          )}
          {(currentState === "final_edit" || currentState === "post_condition_survey") && hasGeneratedDraft ? (
            <div className="card" style={{ background: "var(--muted)" }}>
              <p>
                <strong>Your bullets:</strong>
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
              title={guidance.tooltip}
              onClick={onRunEditorSuggestions}
            >
              {isEditorGenerating ? "Generating Suggestions…" : "Get Revision Suggestions"}
            </button>
          ) : null}

          {currentState === "ai_revision" || currentState === "final_edit" || currentState === "post_condition_survey" ? (
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
                const updatedText = appliedSuggestionText[suggestion.id];
                const isModifying = modifyingId === suggestion.id;
                return (
                  <div className="card" key={suggestion.id} style={{ borderLeft: `3px solid ${statusColors[status] ?? "#6b7280"}` }}>
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
                      <span className="tag" style={{ color: statusColors[status], borderColor: statusColors[status] }}>
                        {statusLabels[status] ?? status}
                      </span>
                    </div>
                    <p>
                      <strong>Original:</strong> <em>{suggestion.originalSegment}</em>
                    </p>
                    <p style={{ marginTop: "0.3rem" }}>
                      <strong>Suggested:</strong> {suggestion.suggestedChange}
                    </p>
                    {updatedText ? (
                      <p style={{ marginTop: "0.3rem" }}>
                        <strong>Updated in editor:</strong> {updatedText}
                      </p>
                    ) : null}
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
                            onChange={(event) => onModifyTextChange(event.target.value)}
                            placeholder="Edit the suggestion before applying…"
                          />
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button
                              className="primary"
                              type="button"
                              disabled={!modifyText.trim()}
                              onClick={() => onApplySuggestion(suggestion, "modify", modifyText)}
                            >
                              Apply
                            </button>
                            <button type="button" onClick={onCancelModify}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                          <button
                            type="button"
                            title="Replace the original sentence with the suggested one."
                            onClick={() => onApplySuggestion(suggestion, "accept")}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            title="Edit the suggestion before applying it."
                            onClick={() => onStartModify(suggestion.id, suggestion.suggestedChange)}
                          >
                            Modify
                          </button>
                          <button
                            type="button"
                            title="Keep your original wording."
                            onClick={() => onApplySuggestion(suggestion, "reject")}
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
                  onClick={onToFinalEdit}
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
                    onChange={(event) =>
                      onBulletsChange((prev) => prev.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))
                    }
                    disabled={busy}
                  />
                </label>
              ))}
              {bullets.length < 5 ? (
                <button
                  type="button"
                  disabled={busy}
                  title="Adds an optional fourth or fifth bullet."
                  onClick={() => onBulletsChange((prev) => [...prev, ""])}
                >
                  Add Bullet
                </button>
              ) : null}
              <button
                className="primary"
                type="button"
                disabled={busy}
                title={guidance.tooltip}
                onClick={onStartThoughtPartnerQuestions}
              >
                {isThoughtPartnerGenerating ? "Starting Questions…" : "Start Questions"}
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
                <p>{currentQuestion?.question}</p>
                <textarea
                  value={questionAnswers[activeQuestionIndex] ?? ""}
                  onChange={(event) => onQuestionAnswerChange(activeQuestionIndex, event.target.value)}
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
                    onClick={onContinueQuestionFlow}
                  >
                    Next Question
                  </button>
                ) : (
                  <button
                    className="primary"
                    type="button"
                    disabled={busy || !allQuestionsAnswered}
                    title="Finishes reflection and shows your responses for reference."
                    onClick={onFinishReflections}
                  >
                    Finish Reflections
                  </button>
                )}
              </div>
              <div className="stack-sm">
                {thoughtPartnerOutput.reflectiveQuestions.map((question, index) =>
                  (questionAnswers[index] ?? "").trim().length > 0 ? (
                    <div className="card" key={`${question.dimension}-${question.question}`}>
                      <p>
                        <strong>Answered Q{index + 1}</strong>
                      </p>
                      <p style={{ marginTop: "0.2rem", fontWeight: 600 }}>{question.question}</p>
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
                    <div key={`${question.dimension}-${question.question}`} style={{ marginBottom: "0.6rem" }}>
                      <p style={{ fontWeight: 600, fontSize: "0.9em" }}>Q{index + 1}</p>
                      <p style={{ marginTop: "0.2rem", fontWeight: 600 }}>{question.question}</p>
                      <p style={{ marginTop: "0.2rem" }}>{questionAnswers[index] ?? ""}</p>
                    </div>
                  ))}
                </div>
              </div>
              <button
                className="primary"
                type="button"
                disabled={busy}
                title="Closes AI help and lets you draft the message on your own."
                onClick={onToIndependentDrafting}
              >
                Start Drafting on Your Own
              </button>
            </>
          ) : null}

          {(currentState === "independent_drafting" || currentState === "final_edit" || currentState === "post_condition_survey") &&
          thoughtPartnerOutput ? (
            <div className="card" style={{ background: "var(--muted)" }}>
              <p>
                <strong>Your Responses</strong>
              </p>
              <div className="stack-sm" style={{ marginTop: "0.5rem" }}>
                {thoughtPartnerOutput.reflectiveQuestions.map((question, index) => (
                  <div key={`${question.dimension}-${question.question}`} style={{ marginBottom: "0.6rem" }}>
                    <p style={{ fontWeight: 600, fontSize: "0.9em" }}>Q{index + 1}</p>
                    <p style={{ marginTop: "0.2rem", fontWeight: 600 }}>{question.question}</p>
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
  );
}
