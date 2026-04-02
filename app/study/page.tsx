"use client";

import { ConsentFormContent } from "@/components/study/ConsentFormContent";
import { CONSENT_OPTION_NO, CONSENT_OPTION_YES, CONSENT_QUESTION } from "@/components/study/consent";
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
  const [consentChoice, setConsentChoice] = useState("");
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
              <h1 id="consent-modal-title">Consent Form</h1>
            </div>

            <div className="consent-modal-body">
              <ConsentFormContent />
            </div>

            <div className="consent-copy-section">
              <p>
                <strong>{CONSENT_QUESTION}</strong>
              </p>

              <label className="consent-check-row">
                <input
                  type="radio"
                  name="consent-choice"
                  checked={consentChoice === CONSENT_OPTION_YES}
                  onChange={() => setConsentChoice(CONSENT_OPTION_YES)}
                />
                <span>{CONSENT_OPTION_YES}</span>
              </label>

              <label className="consent-check-row">
                <input
                  type="radio"
                  name="consent-choice"
                  checked={consentChoice === CONSENT_OPTION_NO}
                  onChange={() => setConsentChoice(CONSENT_OPTION_NO)}
                />
                <span>{CONSENT_OPTION_NO}</span>
              </label>

              {consentChoice === CONSENT_OPTION_NO ? (
                <p className="text-warning">You cannot continue to the access code page unless you consent to participate.</p>
              ) : null}
            </div>

            <div className="row-wrap">
              <Button disabled={consentChoice !== CONSENT_OPTION_YES} onClick={() => setConsentOpen(false)}>
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
