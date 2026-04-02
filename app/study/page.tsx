"use client";

import { StudyContactBar } from "@/components/study/StudyContactBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function StudyLoginPage() {
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentOpen, setConsentOpen] = useState(true);
  const router = useRouter();

  async function handleLogin(): Promise<void> {
    const normalized = accessCode.trim().toUpperCase();
    if (!normalized) {
      setError("Access code is required.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/study/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: normalized })
      });
      const json = (await response.json()) as { accessCode?: string; error?: string };
      if (!response.ok || !json.accessCode) {
        throw new Error(json.error ?? "Login failed");
      }

      router.push(`/study/${json.accessCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-stack study-public-shell">
      {consentOpen ? (
        <div className="consent-modal-backdrop" role="presentation">
          <section
            className="consent-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="consent-modal-title"
          >
            <div className="consent-modal-header">
              <p className="consent-modal-kicker">UBC Human-Computer Interaction Course Project</p>
              <h1 id="consent-modal-title">Consent Form</h1>
              <p>
                Please read this summary before entering the study. Full consent details and confirmation fields are
                collected again inside the integrated pre-study survey.
              </p>
            </div>

            <div className="consent-modal-body">
              <section className="consent-copy-section">
                <h2>Study Team</h2>
                <p>
                  Principal Investigator: Dongwook Yoon, Associate Professor, Department of Computer Science,
                  University of British Columbia, <a href="mailto:yoon@cs.ubc.ca">yoon@cs.ubc.ca</a>, 604-822-1993
                </p>
                <p>
                  Student Investigators: Yuri Kim, <a href="mailto:yurikim1@cs.ubc.ca">yurikim1@cs.ubc.ca</a> · Kevin
                  Wang, <a href="mailto:kevinsk@student.ubc.ca">kevinsk@student.ubc.ca</a>
                </p>
              </section>

              <section className="consent-copy-section">
                <h2>Purpose and Eligibility</h2>
                <p>
                  This study explores how people interact with different AI-assisted writing tools when composing
                  messages to others. It is intended for people who have used AI chatbots such as ChatGPT, Claude, or
                  Grammarly at least a few times before and are open to using them for writing tasks.
                </p>
              </section>

              <section className="consent-copy-section">
                <h2>What You Will Do</h2>
                <ul>
                  <li>Complete the study in one sitting using this web-based interface.</li>
                  <li>Answer the integrated pre-study and post-study questionnaires on the site.</li>
                  <li>Optionally join a Zoom follow-up interview later.</li>
                </ul>
                <p>
                  The system portion takes about 30-45 minutes. If you also join the interview, the full commitment is
                  about 45-60 minutes.
                </p>
                <p>
                  Some of the writing tasks may feel emotionally demanding. You may stop at any time if you no longer
                  wish to participate.
                </p>
              </section>

              <section className="consent-copy-section">
                <h2>Data and Confidentiality</h2>
                <p>
                  Your responses will be used for course-project analysis and presentations, and the project may later
                  be extended into research publication work. Data will be stored in Canada and reported without naming
                  you directly.
                </p>
                <p>
                  If you participate in the optional Zoom interview, you may choose not to be video or audio recorded.
                  You may also use a nickname, turn off your camera, or mute when appropriate.
                </p>
              </section>

              <section className="consent-copy-section">
                <h2>Questions or Concerns</h2>
                <p>
                  For study support, text Kevin Wang at <a href="tel:2368670839">236-867-0839</a> or email{" "}
                  <a href="mailto:kevinwang1262000@gmail.com">kevinwang1262000@gmail.com</a>. For participant-rights
                  concerns, contact the UBC Research Participant Complaint Line at 604-822-8598 or{" "}
                  <a href="mailto:RSIL@ors.ubc.ca">RSIL@ors.ubc.ca</a>.
                </p>
              </section>
            </div>

            <label className="consent-check-row">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(event) => setConsentChecked(event.target.checked)}
              />
              <span>I have read this summary and consent to continue to the study access page.</span>
            </label>

            <div className="row-wrap">
              <Button disabled={!consentChecked} onClick={() => setConsentOpen(false)}>
                Continue to Access Code
              </Button>
            </div>
          </section>
        </div>
      ) : null}

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
            <p>
              You will confirm consent details, provide your email address, and answer the integrated pre-study survey
              after you enter your access code.
            </p>
            <p>
              <strong>Need a code?</strong> Text Kevin at <a href="tel:2368670839">236-867-0839</a> or email{" "}
              <a href="mailto:kevinwang1262000@gmail.com">kevinwang1262000@gmail.com</a> to get your access code.
            </p>
          </div>

          <Label>
            Access Code
            <Input
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
              placeholder="AIMC-7K2M"
            />
          </Label>

          <div className="row-wrap">
            <Button disabled={loading} onClick={() => void handleLogin()}>
              Continue Study
            </Button>
          </div>

          {error ? <p className="text-warning">{error}</p> : null}
        </CardContent>
      </Card>

      <StudyContactBar showAccessCodeHelp />
    </main>
  );
}
