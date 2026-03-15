import type { AssignmentCell, RoleCondition } from "@/lib/types";

const ORDER_PATTERNS: Array<{
  patternId: "P1" | "P2" | "P3";
  first: RoleCondition[];
  second: RoleCondition[];
}> = [
  {
    patternId: "P1",
    first: ["drafter", "revisor", "facilitator"],
    second: ["facilitator", "revisor", "drafter"]
  },
  {
    patternId: "P2",
    first: ["drafter", "facilitator", "revisor"],
    second: ["revisor", "facilitator", "drafter"]
  },
  {
    patternId: "P3",
    first: ["revisor", "drafter", "facilitator"],
    second: ["facilitator", "drafter", "revisor"]
  }
];

export const DEFAULT_TARGET_N = Number(process.env.AIMC_TARGET_N ?? 18);

export const STUDY_MODEL = process.env.AIMC_MODEL ?? "gpt-5-mini";

export function getCounterbalanceCells(): AssignmentCell[] {
  const scenario1First: AssignmentCell[] = ORDER_PATTERNS.map((pattern) => ({
    cellId: `scenario_1:${pattern.patternId}`,
    scenarioFirst: "scenario_1",
    patternId: pattern.patternId,
    scenario1Order: [...pattern.first],
    scenario2Order: [...pattern.second]
  }));

  const scenario2First: AssignmentCell[] = ORDER_PATTERNS.map((pattern) => ({
    cellId: `scenario_2:${pattern.patternId}`,
    scenarioFirst: "scenario_2",
    patternId: pattern.patternId,
    scenario1Order: [...pattern.second],
    scenario2Order: [...pattern.first]
  }));

  return [...scenario1First, ...scenario2First];
}
