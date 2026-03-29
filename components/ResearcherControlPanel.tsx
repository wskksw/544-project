"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow
} from "@/components/ui/table";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Condition = "drafter" | "revisor" | "facilitator";

type MatrixParticipant = {
  participantId: string;
  participantLabel: string;
  accessCode: string;
  sessionId: string | null;
  sessionStatus: string;
  currentState: string | null;
  currentTrialIndex: number | null;
  completedTrials: number;
  totalTrials: number;
};

type MatrixCell = {
  cellId: string;
  scenarioFirst: "scenario_1" | "scenario_2";
  roleOrderId: string;
  conditionOrder: Condition[];
  count: number;
  participants: MatrixParticipant[];
};

type AssignmentPayload = {
  cells: MatrixCell[];
  sessions: Array<Record<string, unknown>>;
  lockedTargetN: number | null;
};

type PopulateResponse = {
  targetN: number;
  existing: number;
  created: number;
  total: number;
};

export function ResearcherControlPanel() {
  const [targetN, setTargetN] = useState("24");
  const [message, setMessage] = useState<string>("");
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});
  const [savingLabelId, setSavingLabelId] = useState<string | null>(null);
  const [data, setData] = useState<AssignmentPayload | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadAssignments(): Promise<void> {
    const response = await fetch("/api/researcher/assignments", { cache: "no-store" });
    const json = (await response.json()) as AssignmentPayload;
    setData(json);
  }

  useEffect(() => {
    void loadAssignments();
  }, []);

  useEffect(() => {
    if (data?.lockedTargetN) {
      setTargetN(String(data.lockedTargetN));
    }
  }, [data?.lockedTargetN]);

  const quotaHint = useMemo(() => {
    const parsed = Number(targetN);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return "Target N must be positive.";
    }
    if (parsed % 12 !== 0) {
      return "Target N should be a multiple of 12 (12 counterbalance cells).";
    }
    return `Quota per cell: ${parsed / 12}`;
  }, [targetN]);

  const participants = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.cells.flatMap((cell) =>
      cell.participants.map((participant) => ({
        ...participant,
        cellId: cell.cellId,
        scenarioFirst: cell.scenarioFirst,
        conditionOrder: cell.conditionOrder
      }))
    );
  }, [data]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const participant of participants) {
      next[participant.participantId] = participant.participantLabel;
    }
    setLabelDrafts(next);
  }, [participants]);

  const groupedCells = useMemo(() => {
    const scenario1 = data?.cells.filter((cell) => cell.scenarioFirst === "scenario_1") ?? [];
    const scenario2 = data?.cells.filter((cell) => cell.scenarioFirst === "scenario_2") ?? [];
    return { scenario1, scenario2 };
  }, [data]);

  async function populateParticipants(): Promise<void> {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/researcher/populate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetN: Number(targetN)
        })
      });

      const json = (await response.json()) as PopulateResponse | { error: string };
      if (!response.ok) {
        throw new Error("error" in json ? json.error : "Registration failed");
      }
      if ("error" in json) {
        throw new Error(json.error);
      }

      setMessage(`Population complete: created ${json.created} participant(s), total ${json.total}.`);
      await loadAssignments();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function saveParticipantLabel(participantId: string): Promise<void> {
    const nextLabel = (labelDrafts[participantId] ?? "").trim();
    if (!nextLabel) {
      setMessage("Participant label cannot be empty.");
      return;
    }

    setSavingLabelId(participantId);
    setMessage("");
    try {
      const response = await fetch(`/api/researcher/participants/${participantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantLabel: nextLabel })
      });
      const json = (await response.json()) as { participantLabel?: string; error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "Failed to update participant label");
      }

      setMessage(`Updated participant label to "${json.participantLabel ?? nextLabel}".`);
      await loadAssignments();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSavingLabelId(null);
    }
  }

  return (
    <div className="layout-grid">
      <Card>
        <CardHeader>
          <CardTitle>Participant Dash</CardTitle>
          <CardDescription>
            Set target N, generate participants, monitor balancing, and export participant-level data.
          </CardDescription>
        </CardHeader>

        <CardContent className="stack-md">
          <Label style={{ maxWidth: 220 }}>
            Target N
            <Input
              value={targetN}
              onChange={(event) => setTargetN(event.target.value)}
              disabled={Boolean(data?.lockedTargetN)}
            />
          </Label>

          <p className="text-muted">{quotaHint}</p>
          <p className="text-muted">
            {data?.lockedTargetN
              ? `Target N is locked at ${data.lockedTargetN} after first registration.`
              : "Set target N, then generate access codes. Auto-assignment uses least-filled cell."}
          </p>

          <div className="row-wrap">
            <Button disabled={loading} onClick={() => void populateParticipants()}>
              Populate To Target N
            </Button>
            <Button variant="outline" onClick={() => void loadAssignments()}>
              Refresh
            </Button>
            <a
              className={buttonVariants({ variant: "outline" })}
              href="/api/researcher/export/participants-csv"
              target="_blank"
              rel="noreferrer"
            >
              Export Participants CSV
            </a>
            <Link className={buttonVariants({ variant: "outline" })} href="/researcher/playground">
              Open Condition Playground
            </Link>
            <Link className={buttonVariants({ variant: "outline" })} href="/researcher/surveys">
              Go To Survey Area
            </Link>
          </div>

          {message ? <p className="text-warning">{message}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Counterbalance Matrix (12 Cells)</CardTitle>
          <CardDescription>
            Auto-assignment fills least-populated cells under the current target quota.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="matrix-grid">
            {[
              { label: "Scenario 1 First", cells: groupedCells.scenario1 },
              { label: "Scenario 2 First", cells: groupedCells.scenario2 }
            ].map((group) => (
              <div key={group.label} className="matrix-column stack-sm">
                <h3>{group.label}</h3>
                <div className="stack-sm">
                  {group.cells.map((cell) => (
                    <div key={cell.cellId} className="matrix-cell">
                      <strong>{cell.cellId}</strong>
                      <span>Role order: {cell.conditionOrder.join(" -> ")}</span>
                      <span>Filled: {cell.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Participant Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Label</TableHeaderCell>
                <TableHeaderCell>Access Code</TableHeaderCell>
                <TableHeaderCell>Cell</TableHeaderCell>
                <TableHeaderCell>Progress</TableHeaderCell>
                <TableHeaderCell>Completed</TableHeaderCell>
                <TableHeaderCell>Open</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {participants.length ? (
                participants
                  .sort((a, b) => a.participantLabel.localeCompare(b.participantLabel))
                  .map((participant) => (
                    <TableRow key={participant.participantId}>
                      <TableCell>
                        <div className="stack-sm">
                          <Input
                            value={labelDrafts[participant.participantId] ?? participant.participantLabel}
                            onChange={(event) =>
                              setLabelDrafts((prev) => ({
                                ...prev,
                                [participant.participantId]: event.target.value
                              }))
                            }
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={savingLabelId === participant.participantId}
                            onClick={() => void saveParticipantLabel(participant.participantId)}
                          >
                            Save Label
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>{participant.accessCode}</TableCell>
                      <TableCell>{participant.cellId}</TableCell>
                      <TableCell>
                        {participant.completedTrials}/{participant.totalTrials}
                      </TableCell>
                      <TableCell>{participant.sessionStatus === "completed" ? "Yes" : "No"}</TableCell>
                      <TableCell>
                        <Link
                          className={buttonVariants({ variant: "link" })}
                          href={`/study/${participant.accessCode}`}
                        >
                          Participant
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6}>No participants yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
