"use client";

import type {
  Condition,
  HighlightStatus,
  SessionPayload,
  StudyState
} from "@/components/study/types";
import { getScenarioClosingInstruction, splitBoldText } from "@/components/study/utils";

type PreviewSegment = { text: string; status: HighlightStatus | null };

export function MainEditorPanel({
  snapshot,
  condition,
  currentState,
  editorText,
  editorEnabled,
  busy,
  isEditorGenerating,
  isGhostWriterGenerating,
  editorPreviewSegments,
  wordCount,
  error,
  onEditorChange,
  onEditorKeyDown,
  onStartConditionFlow,
  onCompleteThoughtPartnerDraft,
  onToFinalEdit,
  onToSurvey
}: {
  snapshot: SessionPayload;
  condition: Condition;
  currentState: StudyState;
  editorText: string;
  editorEnabled: boolean;
  busy: boolean;
  isEditorGenerating: boolean;
  isGhostWriterGenerating: boolean;
  editorPreviewSegments: PreviewSegment[];
  wordCount: number;
  error: string;
  onEditorChange: (nextText: string) => void;
  onEditorKeyDown: () => void;
  onStartConditionFlow: () => void;
  onCompleteThoughtPartnerDraft: () => void;
  onToFinalEdit: () => void;
  onToSurvey: () => void;
}) {
  const taskInstructionSegments = splitBoldText(getScenarioClosingInstruction(condition));
  const editorLockCopy = (() => {
    switch (currentState) {
      case "scenario_intro":
        return {
          banner: "Locked until the task starts",
          detail: "Click Start When Ready to begin this round and unlock the editor."
        };
      case "bullet_input":
        return condition === "ghost_writer"
          ? {
            banner: "Locked until draft generation",
            detail: "Enter 3-5 bullets in the AI panel, then generate a draft to unlock the editor."
          }
          : {
            banner: "Locked during reflection setup",
            detail: "Enter 3-5 bullets in the AI panel to begin the reflection step before drafting."
          };
      case "reflection_questions":
        return {
          banner: "Locked during reflection",
          detail: "Answer the reflection questions in the AI panel before the editor unlocks."
        };
      case "reflection_summary":
        return {
          banner: "Locked until independent drafting",
          detail: "Review your responses, then click Start Independent Drafting in the AI panel to unlock the editor."
        };
      case "ai_revision":
        return isEditorGenerating
          ? {
            banner: "Locked while suggestions load",
            detail: "Wait for the AI to finish generating revision suggestions."
          }
          : {
            banner: "Locked during revision review",
            detail: "Respond to each suggestion in the AI panel, then continue to final review to unlock the editor."
          };
      case "post_condition_survey":
        return {
          banner: "Locked during survey",
          detail: "The writing task is complete. Finish the survey to move on."
        };
      default:
        return {
          banner: "Editor locked",
          detail: "Complete the current step in the AI panel to unlock the editor."
        };
    }
  })();
  const showLockedEditor = !editorEnabled;
  const showPreviewText = editorText.trim().length > 0;

  return (
    <section className="card">
      <h2>{snapshot.currentTrial.scenario.title}</h2>
      <p style={{ color: "black", whiteSpace: "pre-wrap" }}>{snapshot.currentTrial.scenario.description}</p>
      <p style={{ color: "black", marginTop: "0.5rem" }}>
        <strong>Task:</strong>{" "}
        {taskInstructionSegments.map((segment, index) =>
          segment.bold ? <strong key={`${segment.text}-${index}`}>{segment.text}</strong> : segment.text
        )}
      </p>

      <h3>Main Editor</h3>
      {showLockedEditor ? (
        <div
          title={editorLockCopy.detail}
          style={{ cursor: "not-allowed", position: "relative" }}
        >
          <div className="editor-locked-shell">
            <div className="editor-locked-banner">{editorLockCopy.banner}</div>
            <div className="editor-locked-preview" aria-readonly="true">
              <p className="editor-locked-message">{editorLockCopy.detail}</p>
              {showPreviewText ? (
                <div className="editor-locked-content">
                  {editorPreviewSegments.map((segment, index) =>
                    segment.status ? (
                      <span key={`${index}-${segment.status}`} className={`editor-highlight editor-highlight-${segment.status}`}>
                        {segment.text}
                      </span>
                    ) : (
                      <span key={`${index}-plain`}>{segment.text}</span>
                    )
                  )}
                </div>
              ) : (
                <p className="editor-locked-placeholder">
                  {condition === "ghost_writer"
                    ? "Your generated draft will appear here once it is ready."
                    : condition === "thought_partner"
                      ? "Your draft area will open here after the reflection step."
                      : "Your draft will remain here while you review revision suggestions."}
                </p>
              )}
              {isGhostWriterGenerating ? <p className="editor-locked-status">Ghost Writer is drafting your message...</p> : null}
              {isEditorGenerating ? <p className="editor-locked-status">Editor is reviewing your draft...</p> : null}
            </div>
          </div>
        </div>
      ) : (
        <textarea
          value={editorText}
          onChange={(event) => onEditorChange(event.target.value)}
          onKeyDown={onEditorKeyDown}
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
            onClick={onStartConditionFlow}
          >
            Start When Ready
          </button>
        ) : null}

        {currentState === "independent_drafting" ? (
          <button
            className="primary"
            disabled={busy || !editorText.trim()}
            title={
              condition === "thought_partner"
                ? "Completes your draft and opens the post-condition survey."
                : "Locks in your independent draft and moves to the final review step."
            }
            onClick={condition === "thought_partner" ? onCompleteThoughtPartnerDraft : onToFinalEdit}
          >
            {condition === "thought_partner" ? "Complete & Open Survey" : "Continue to Final Review"}
          </button>
        ) : null}

        {currentState === "final_edit" ? (
          <button
            className="primary"
            disabled={busy}
            title="Opens the post-condition survey for this study block."
            onClick={onToSurvey}
          >
            Continue to Post-Condition Survey
          </button>
        ) : null}
      </div>

      {error ? <p style={{ color: "var(--destructive)", marginTop: "0.5rem" }}>{error}</p> : null}
    </section>
  );
}
