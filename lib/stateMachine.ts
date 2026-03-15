import type { RoleCondition, StudyState } from "@/lib/types";

const conditionTransitions: Record<RoleCondition, Record<StudyState, StudyState[]>> = {
  drafter: {
    scenario_intro: ["bullet_input"],
    bullet_input: ["ai_generation"],
    ai_generation: ["final_edit"],
    final_edit: ["post_condition_survey"],
    post_condition_survey: ["inter_condition_buffer"],
    human_drafting: [],
    ai_revision: [],
    reflection_questions: [],
    reflection_summary: [],
    independent_drafting: [],
    optional_feedback: [],
    inter_condition_buffer: []
  },
  revisor: {
    scenario_intro: ["human_drafting"],
    human_drafting: ["ai_revision"],
    ai_revision: ["final_edit"],
    final_edit: ["post_condition_survey"],
    post_condition_survey: ["inter_condition_buffer"],
    bullet_input: [],
    ai_generation: [],
    reflection_questions: [],
    reflection_summary: [],
    independent_drafting: [],
    optional_feedback: [],
    inter_condition_buffer: []
  },
  facilitator: {
    scenario_intro: ["bullet_input"],
    bullet_input: ["reflection_questions"],
    reflection_questions: ["reflection_summary"],
    reflection_summary: ["independent_drafting"],
    independent_drafting: ["optional_feedback", "final_edit"],
    optional_feedback: ["final_edit"],
    final_edit: ["post_condition_survey"],
    post_condition_survey: ["inter_condition_buffer"],
    human_drafting: [],
    ai_generation: [],
    ai_revision: [],
    inter_condition_buffer: []
  }
};

export function canTransition(condition: RoleCondition, from: StudyState, to: StudyState): boolean {
  return conditionTransitions[condition][from]?.includes(to) ?? false;
}

export function getInitialState(): StudyState {
  return "scenario_intro";
}

export function getStateSequenceForCondition(condition: RoleCondition): StudyState[] {
  if (condition === "drafter") {
    return ["scenario_intro", "bullet_input", "ai_generation", "final_edit", "post_condition_survey"];
  }

  if (condition === "revisor") {
    return ["scenario_intro", "human_drafting", "ai_revision", "final_edit", "post_condition_survey"];
  }

  return [
    "scenario_intro",
    "bullet_input",
    "reflection_questions",
    "reflection_summary",
    "independent_drafting",
    "optional_feedback",
    "final_edit",
    "post_condition_survey"
  ];
}
