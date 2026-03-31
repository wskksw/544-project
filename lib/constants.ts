import type { AssignmentCell } from "@/lib/types";

export const DEFAULT_TARGET_N = Number(process.env.AIMC_TARGET_N ?? 18);

export const STUDY_MODEL = process.env.AIMC_MODEL ?? "gpt-5.4-mini";

export const COUNTERBALANCE_CELLS: AssignmentCell[] = [
  {
    cellId: "S1",
    trialSpecs: [
      { condition: "thought_partner", scenarioId: "scenario_a" },
      { condition: "editor", scenarioId: "scenario_b" },
      { condition: "ghost_writer", scenarioId: "scenario_c" }
    ]
  },
  {
    cellId: "S2",
    trialSpecs: [
      { condition: "editor", scenarioId: "scenario_a" },
      { condition: "ghost_writer", scenarioId: "scenario_b" },
      { condition: "thought_partner", scenarioId: "scenario_c" }
    ]
  },
  {
    cellId: "S3",
    trialSpecs: [
      { condition: "ghost_writer", scenarioId: "scenario_a" },
      { condition: "thought_partner", scenarioId: "scenario_b" },
      { condition: "editor", scenarioId: "scenario_c" }
    ]
  }
];

export function getCounterbalanceCells(): AssignmentCell[] {
  return COUNTERBALANCE_CELLS.map((cell) => ({
    cellId: cell.cellId,
    trialSpecs: cell.trialSpecs.map((spec) => ({ ...spec }))
  }));
}
