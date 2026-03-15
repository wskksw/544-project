"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type RegisterResponse = {
  sessionId: string;
  assignment: {
    participant_id: string;
    cell_id: string;
    scenario_first: string;
    target_n: number;
  };
};

type AssignmentPayload = {
  assignments: Array<Record<string, unknown>>;
  sessions: Array<Record<string, unknown>>;
  cellCounts: Array<Record<string, unknown>>;
};

export function ResearcherControlPanel() {
  const [participantId, setParticipantId] = useState("");
  const [targetN, setTargetN] = useState("18");
  const [message, setMessage] = useState<string>("");
  const [data, setData] = useState<AssignmentPayload | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(): Promise<void> {
    const response = await fetch("/api/researcher/assignments", { cache: "no-store" });
    const json = (await response.json()) as AssignmentPayload;
    setData(json);
  }

  useEffect(() => {
    void load();
  }, []);

  const quotaHint = useMemo(() => {
    const parsed = Number(targetN);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return "Target N must be positive.";
    }
    if (parsed % 6 !== 0) {
      return "Target N must be a multiple of 6.";
    }
    return `Quota per cell: ${parsed / 6}`;
  }, [targetN]);

  async function registerParticipant(): Promise<void> {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/researcher/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId,
          targetN: Number(targetN)
        })
      });

      const json = (await response.json()) as RegisterResponse | { error: string };
      if (!response.ok) {
        throw new Error("error" in json ? json.error : "Registration failed");
      }
      if ("error" in json) {
        throw new Error(json.error);
      }

      setMessage(
        `Assigned ${json.assignment.participant_id} to ${json.assignment.cell_id}. Session: ${json.sessionId}`
      );
      setParticipantId("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="layout-grid">
      <section className="card">
        <h2>Participant Registration</h2>
        <p style={{ color: "var(--muted)" }}>
          Counterbalancing is enforced at registration time. Existing participants reuse their active
          session.
        </p>

        <div style={{ display: "grid", gap: "0.7rem", gridTemplateColumns: "1fr 160px" }}>
          <label>
            Participant ID
            <input
              value={participantId}
              onChange={(event) => setParticipantId(event.target.value)}
              placeholder="e.g., P014"
            />
          </label>
          <label>
            Target N
            <input value={targetN} onChange={(event) => setTargetN(event.target.value)} />
          </label>
        </div>

        <p style={{ marginTop: "0.4rem", color: "var(--muted)" }}>{quotaHint}</p>

        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button
            className="primary"
            type="button"
            disabled={loading || !participantId.trim()}
            onClick={() => void registerParticipant()}
          >
            Assign + Launch Session
          </button>
          <button type="button" onClick={() => void load()}>
            Refresh
          </button>
          <a href="/api/researcher/export" target="_blank" rel="noreferrer">
            <button type="button">Export Logs/Data (JSON)</button>
          </a>
          <Link href="/researcher/playground">
            <button type="button">Open Condition Playground</button>
          </Link>
        </div>

        {message ? (
          <p style={{ marginTop: "0.7rem", color: "var(--warn)", fontWeight: 600 }}>{message}</p>
        ) : null}
      </section>

      <section className="card">
        <h2>Counterbalance Cell Counts</h2>
        <table>
          <thead>
            <tr>
              <th>Cell</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {data?.cellCounts?.length ? (
              data.cellCounts.map((row) => (
                <tr key={String(row.cell_id)}>
                  <td>{String(row.cell_id)}</td>
                  <td>{String(row.count)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2}>No assignments yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Active / Completed Sessions</h2>
        <table>
          <thead>
            <tr>
              <th>Session</th>
              <th>Participant</th>
              <th>Status</th>
              <th>Trial</th>
              <th>Condition</th>
              <th>Scenario</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {data?.sessions?.length ? (
              data.sessions.map((row) => (
                <tr key={String(row.id)}>
                  <td>{String(row.id).slice(0, 8)}</td>
                  <td>{String(row.participant_id)}</td>
                  <td>{String(row.status)}</td>
                  <td>{String(row.current_trial_index)}</td>
                  <td>{String(row.condition ?? "-")}</td>
                  <td>{String(row.scenario_id ?? "-")}</td>
                  <td>
                    <Link href={`/session/${String(row.id)}`}>Open</Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7}>No sessions yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
