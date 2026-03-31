"use client";

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
    <main className="page-stack">
      <Card style={{ maxWidth: 560, margin: "0 auto" }}>
        <CardHeader>
          <CardTitle>Participant Login</CardTitle>
          <CardDescription>Enter your study access code to continue your session.</CardDescription>
        </CardHeader>

        <CardContent className="stack-md">
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
    </main>
  );
}
