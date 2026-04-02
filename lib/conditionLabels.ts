import type { RoleCondition } from "@/lib/types";

export const CONDITION_DISPLAY_LABELS: Record<RoleCondition, string> = {
  thought_partner: "Brainstorm Assistant",
  editor: "Editor Assistant",
  ghost_writer: "Drafter Assistant"
};

export function getConditionDisplayLabel(condition: RoleCondition): string {
  return CONDITION_DISPLAY_LABELS[condition];
}
