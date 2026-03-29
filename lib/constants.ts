import type { AssignmentCell, RoleCondition } from "@/lib/types";

const ROLE_ORDERS: RoleCondition[][] = [
  ["drafter", "revisor", "facilitator"],
  ["drafter", "facilitator", "revisor"],
  ["revisor", "drafter", "facilitator"],
  ["revisor", "facilitator", "drafter"],
  ["facilitator", "drafter", "revisor"],
  ["facilitator", "revisor", "drafter"]
];

export const DEFAULT_TARGET_N = Number(process.env.AIMC_TARGET_N ?? 24);

export const STUDY_MODEL = process.env.AIMC_MODEL ?? "gpt-5-mini";

export function getCounterbalanceCells(): AssignmentCell[] {
  const cells: AssignmentCell[] = [];

  for (const scenarioFirst of ["scenario_1", "scenario_2"] as const) {
    ROLE_ORDERS.forEach((order, index) => {
      const roleOrderId = `R${index + 1}`;
      cells.push({
        cellId: `${scenarioFirst}:${roleOrderId}`,
        scenarioFirst,
        roleOrderId,
        conditionOrder: [...order]
      });
    });
  }

  return cells;
}
