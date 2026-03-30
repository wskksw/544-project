import type { RoleCondition, SurveyItem } from "@/lib/types";

export function isSurveyItemVisible(
  item: SurveyItem,
  answers: Record<string, unknown> = {},
  condition?: RoleCondition
): boolean {
  if (condition && item.condition !== "all" && item.condition !== condition) {
    return false;
  }

  if (!item.dependsOnItemId || !item.dependsOnValue || item.dependsOnValue.length === 0) {
    return true;
  }

  const dependencyValue = answers[item.dependsOnItemId];
  return typeof dependencyValue === "string" && item.dependsOnValue.includes(dependencyValue);
}

export function visibleSurveyItems(
  items: SurveyItem[],
  answers: Record<string, unknown> = {},
  condition?: RoleCondition
): SurveyItem[] {
  return items.filter((item) => isSurveyItemVisible(item, answers, condition));
}
