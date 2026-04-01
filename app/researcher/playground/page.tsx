"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { getConditionDisplayLabel } from "@/lib/conditionLabels";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PlaygroundPage() {
  const [condition, setCondition] = useState("thought_partner");
  const [scenarioId, setScenarioId] = useState("scenario_a");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function launch(): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/researcher/playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ condition, scenarioId })
      });
      const json = (await response.json()) as { sessionId?: string; error?: string };
      if (!response.ok || !json.sessionId) {
        throw new Error(json.error ?? "Failed to create playground session");
      }
      router.push(`/session/${json.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-stack">
      <Card style={{ maxWidth: 640 }}>
        <CardHeader>
          <CardTitle>Condition Playground</CardTitle>
          <CardDescription>
            Create a sandbox one-trial session to manually test any condition and scenario.
          </CardDescription>
        </CardHeader>

        <CardContent className="stack-md">
          <Label>
            Condition
            <Select value={condition} onChange={(event) => setCondition(event.target.value)}>
              <option value="thought_partner">{getConditionDisplayLabel("thought_partner")}</option>
              <option value="editor">{getConditionDisplayLabel("editor")}</option>
              <option value="ghost_writer">{getConditionDisplayLabel("ghost_writer")}</option>
            </Select>
          </Label>

          <Label>
            Scenario
            <Select value={scenarioId} onChange={(event) => setScenarioId(event.target.value)}>
              <option value="scenario_a">Scenario A</option>
              <option value="scenario_b">Scenario B</option>
              <option value="scenario_c">Scenario C</option>
            </Select>
          </Label>

          <div className="row-wrap">
            <Button disabled={loading} onClick={() => void launch()}>
              Launch Playground Session
            </Button>
            <Link className={buttonVariants({ variant: "outline" })} href="/researcher">
              Back to Control Panel
            </Link>
          </div>

          {error ? <p className="text-warning">{error}</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}
