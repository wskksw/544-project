import type { RoleCondition } from "@/lib/types";

export const CONDITION_DISPLAY_LABELS: Record<RoleCondition, string> = {
  thought_partner: "Thought Partner",
  editor: "Editor",
  ghost_writer: "Ghost Writer"
};

export function getConditionDisplayLabel(condition: RoleCondition): string {
  return CONDITION_DISPLAY_LABELS[condition];
}
