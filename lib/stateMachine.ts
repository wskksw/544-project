import type { RoleCondition, StudyState } from "@/lib/types";

const conditionTransitions: Record<RoleCondition, Record<StudyState, StudyState[]>> = {
  ghost_writer: {
    practice_intro: ["practice_task"],
    practice_task: ["practice_survey"],
    practice_survey: [],
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
    inter_condition_buffer: ["scenario_intro"],
    post_study_survey: []
  },
  editor: {
    practice_intro: ["practice_task"],
    practice_task: ["practice_survey"],
    practice_survey: [],
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
    inter_condition_buffer: ["scenario_intro"],
    post_study_survey: []
  },
  thought_partner: {
    practice_intro: ["practice_task"],
    practice_task: ["practice_survey"],
    practice_survey: [],
    scenario_intro: ["bullet_input"],
    bullet_input: ["reflection_questions"],
    reflection_questions: ["reflection_summary"],
    reflection_summary: ["independent_drafting"],
    independent_drafting: ["final_edit"],
    final_edit: ["post_condition_survey"],
    post_condition_survey: ["inter_condition_buffer"],
    human_drafting: [],
    ai_generation: [],
    ai_revision: [],
    inter_condition_buffer: ["scenario_intro"],
    post_study_survey: []
  }
};

export function canTransition(condition: RoleCondition, from: StudyState, to: StudyState): boolean {
  return conditionTransitions[condition][from]?.includes(to) ?? false;
}

export function getInitialState(): StudyState {
  return "practice_intro";
}

export function getStateSequenceForCondition(condition: RoleCondition): StudyState[] {
  if (condition === "ghost_writer") {
    return ["scenario_intro", "bullet_input", "ai_generation", "final_edit", "post_condition_survey"];
  }

  if (condition === "editor") {
    return ["scenario_intro", "human_drafting", "ai_revision", "final_edit", "post_condition_survey"];
  }

  return [
    "scenario_intro",
    "bullet_input",
    "reflection_questions",
    "reflection_summary",
    "independent_drafting",
    "final_edit",
    "post_condition_survey"
  ];
}
