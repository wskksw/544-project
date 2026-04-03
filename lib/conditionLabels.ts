import type { RoleCondition } from "@/lib/types";

export const CONDITION_DISPLAY_LABELS: Record<RoleCondition, string> = {
  thought_partner: "AI Assistant",
  editor: "AI Assistant",
  ghost_writer: "AI Assistant"
};

export function getConditionDisplayLabel(condition: RoleCondition): string {
  return CONDITION_DISPLAY_LABELS[condition];
}
