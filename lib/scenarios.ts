import scenariosJson from "@/data/scenarios.json";
import type { Scenario } from "@/lib/types";

export const scenarios = scenariosJson as Scenario[];

export function getScenarioById(scenarioId: string): Scenario {
  const scenario = scenarios.find((item) => item.id === scenarioId);
  if (!scenario) {
    throw new Error(`Unknown scenario: ${scenarioId}`);
  }
  return scenario;
}
