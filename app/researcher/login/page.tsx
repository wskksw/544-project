"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";

const DEFAULT_REDIRECT_PATH = "/researcher";

function sanitizeRedirectPath(path: string | null): string {
  if (!path || !path.startsWith("/")) {
    return DEFAULT_REDIRECT_PATH;
  }
  return path;
}

function ResearcherLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = useMemo(
    () => sanitizeRedirectPath(searchParams.get("next")),
    [searchParams]
  );

  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/researcher/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode })
      });
      const json = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !json.ok) {
        throw new Error(json.error ?? "Invalid researcher access code.");
      }

      router.replace(redirectPath);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card style={{ maxWidth: 520 }}>
      <CardHeader>
        <CardTitle>Researcher Access</CardTitle>
        <CardDescription>Enter the researcher access code to open the control panel.</CardDescription>
      </CardHeader>

      <CardContent className="stack-md">
        <form className="stack-md" onSubmit={(event) => void handleSubmit(event)}>
          <Label htmlFor="researcher-access-code">
            Access Code
            <Input
              id="researcher-access-code"
              autoComplete="off"
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              placeholder="Enter code"
            />
          </Label>

          <div className="row-wrap" style={{ alignItems: "center" }}>
            <Button type="submit" disabled={loading}>
              {loading ? "Checking..." : "Enter Researcher Portal"}
            </Button>
            <Link className={buttonVariants({ variant: "link" })} href="/">
              Back
            </Link>
          </div>
        </form>

        {error ? <p className="text-warning">{error}</p> : null}
      </CardContent>
    </Card>
  );
}

export default function ResearcherLoginPage() {
  return (
    <main className="page-stack">
      <Suspense fallback={<Card className="card">Loading login...</Card>}>
        <ResearcherLoginContent />
      </Suspense>
    </main>
  );
}
