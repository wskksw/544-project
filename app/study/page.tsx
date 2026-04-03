"use client";

import type { SurveyValue } from "@/components/surveys/SurveyQuestionField";
import { PreSurveyForm } from "@/components/study/PreSurveyForm";
import { CONSENT_OPTION_NO } from "@/components/study/consent";
import { StudyContactBar } from "@/components/study/StudyContactBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRE_SURVEY_ITEMS, WHEN2MEET_URL, getPreSurveyValidationError, getTodayDateString, getVisiblePreSurveyItems } from "@/lib/preSurvey";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function StudyLoginPage() {
  const [email, setEmail] = useState("");
  const [showEnrollmentForm, setShowEnrollmentForm] = useState(false);
  const [preSurveyAnswers, setPreSurveyAnswers] = useState<Record<string, SurveyValue>>(() => ({
    pre_today_date: getTodayDateString()
  }));
  const [interviewAvailabilityConfirmed, setInterviewAvailabilityConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [loadingAction, setLoadingAction] = useState<"enroll" | "resume" | null>(null);
  const router = useRouter();

  const isInterviewSelected = preSurveyAnswers.pre_followup_interview === "Yes";
  const visiblePreSurveyItems = getVisiblePreSurveyItems(preSurveyAnswers);
  const preSurveyBlockedForAiInexperience = preSurveyAnswers.pre_prior_ai_usage_frequency === 1;
  const preSurveyBlockedForMissingConsent = preSurveyAnswers.pre_consent === CONSENT_OPTION_NO;
  const enrollSubmitTitle = preSurveyBlockedForMissingConsent
    ? "You must consent to participate before continuing."
    : preSurveyBlockedForAiInexperience
      ? "Participants who have never used AI writing tools are not eligible for this study."
      : isInterviewSelected
        ? "Submit the pre-study survey and continue to the interview instructions."
        : "Submit the pre-study survey and continue to the practice round.";

  function handleOpenEnrollmentForm(): void {
    setShowEnrollmentForm(true);
    setError("");
  }

  function handlePreSurveyChange(itemId: string, next: SurveyValue): void {
    setPreSurveyAnswers((current) => ({
      ...current,
      [itemId]: next
    }));

    if (itemId === "pre_followup_interview" && next !== "Yes") {
      setInterviewAvailabilityConfirmed(false);
    }
  }

  async function handleEnroll(): Promise<void> {
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

    setLoadingAction("enroll");
    setError("");

    try {
      const response = await fetch("/api/study/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses })
      });
      const json = (await response.json()) as { accessCode?: string; error?: string };
      if (!response.ok || !json.accessCode) {
        throw new Error(json.error ?? "Unable to start the study");
      }

      router.push(`/study/${json.accessCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleLogin(): Promise<void> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError("Email is required.");
      return;
    }

    setLoadingAction("resume");
    setError("");

    try {
      const response = await fetch("/api/study/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized })
      });
      const json = (await response.json()) as { accessCode?: string; error?: string };
      if (!response.ok || !json.accessCode) {
        throw new Error(json.error ?? "Login failed");
      }

      router.push(`/study/${json.accessCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <main className="page-stack study-public-shell">
      <Card style={{ maxWidth: 720, margin: "0 auto" }}>
        <CardHeader>
          <CardTitle>Study Access</CardTitle>
          <CardDescription>
            Keep enough uninterrupted time available to finish the system in one sitting. Some of the message-writing
            prompts may feel emotionally demanding.
          </CardDescription>
        </CardHeader>

        <CardContent className="stack-md">
          <div className="study-guide-panel">
            <p>
              <strong>Before you begin:</strong> plan for 30-45 minutes for the study itself. If you are invited to a
              follow-up interview, the full commitment is about 45-60 minutes.
            </p>
            <p>If you leave after that, return here and enter the same email address from the pre-study survey to resume later.</p>
          </div>

          <div className="row-wrap">
            <Button disabled={loadingAction !== null} onClick={handleOpenEnrollmentForm}>
              Start Study Now
            </Button>
          </div>

          <div className="stack-sm" style={{ paddingTop: "0.5rem", borderTop: "1px solid var(--border)" }}>
            <p className="text-muted" style={{ margin: 0 }}>
              Returning participant? Resume with your email address.
            </p>
            <Label>
              Email Address
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
              />
            </Label>

            <div className="row-wrap">
              <Button variant="outline" disabled={loadingAction !== null} onClick={() => void handleLogin()}>
                {loadingAction === "resume" ? "Resuming..." : "Resume Study"}
              </Button>
            </div>
          </div>

          {!showEnrollmentForm && error ? <p className="text-warning">{error}</p> : null}
        </CardContent>
      </Card>

      {showEnrollmentForm ? (
        <Card className="pre-survey-card">
          <CardContent className="stack-md">
            <PreSurveyForm
              items={visiblePreSurveyItems}
              answers={preSurveyAnswers}
              busy={loadingAction === "enroll"}
              isInterviewSelected={isInterviewSelected}
              when2MeetUrl={WHEN2MEET_URL}
              interviewAvailabilityConfirmed={interviewAvailabilityConfirmed}
              onAnswerChange={handlePreSurveyChange}
              onInterviewAvailabilityConfirmedChange={setInterviewAvailabilityConfirmed}
              onSubmit={() => void handleEnroll()}
              submitLabel={isInterviewSelected ? "Continue to Interview Instructions" : "Continue to Practice"}
              submitTitle={enrollSubmitTitle}
              disableSubmit={preSurveyBlockedForAiInexperience || preSurveyBlockedForMissingConsent}
            />
            {error ? <p className="text-warning">{error}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      <StudyContactBar showResumeHelp />
    </main>
  );
}
