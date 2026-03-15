"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PlaygroundPage() {
  const [condition, setCondition] = useState("drafter");
  const [scenarioId, setScenarioId] = useState("scenario_1");
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
    <main>
      <div className="card" style={{ maxWidth: 640 }}>
        <h1>Condition Playground</h1>
        <p style={{ color: "var(--muted)" }}>
          Create a sandbox one-trial session to manually test any condition and scenario.
        </p>

        <label>
          Condition
          <select value={condition} onChange={(event) => setCondition(event.target.value)}>
            <option value="drafter">Drafter</option>
            <option value="revisor">Revisor</option>
            <option value="facilitator">Facilitator</option>
          </select>
        </label>

        <label style={{ marginTop: "0.8rem", display: "block" }}>
          Scenario
          <select value={scenarioId} onChange={(event) => setScenarioId(event.target.value)}>
            <option value="scenario_1">Scenario 1</option>
            <option value="scenario_2">Scenario 2</option>
          </select>
        </label>

        <div style={{ marginTop: "1rem", display: "flex", gap: "0.6rem" }}>
          <button className="primary" type="button" disabled={loading} onClick={() => void launch()}>
            Launch Playground Session
          </button>
          <Link href="/researcher">
            <button type="button">Back to Control Panel</button>
          </Link>
        </div>

        {error ? <p style={{ color: "var(--warn)", marginTop: "0.8rem" }}>{error}</p> : null}
      </div>
    </main>
  );
}
