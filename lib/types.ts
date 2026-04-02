export type RoleCondition = "thought_partner" | "editor" | "ghost_writer";

export type SessionStatus = "active" | "completed";

export type StudyState =
  | "pre_survey"
  | "practice_intro"
  | "practice_task"
  | "practice_survey"
  | "scenario_intro"
  | "bullet_input"
  | "human_drafting"
  | "ai_generation"
  | "ai_revision"
  | "reflection_questions"
  | "reflection_summary"
  | "independent_drafting"
  | "final_edit"
  | "post_condition_survey"
  | "inter_condition_buffer"
  | "post_study_survey";

export type Scenario = {
  id: string;
  title: string;
  description: string;
  requiredElements?: string[];
};

export type TrialPlan = {
  trialIndex: number;
  scenarioId: string;
  condition: RoleCondition;
  orderPosition: number;
  status: "pending" | "active" | "completed";
};

export type TrialSpec = {
  condition: RoleCondition;
  scenarioId: string;
};

export type AssignmentCell = {
  cellId: string;
  trialSpecs: TrialSpec[];
};

export type SurveyItemType = "likert" | "open_text" | "short_text" | "multiple_choice" | "radio" | "ranking";

export type SurveyItem = {
  id: string;
  prompt: string;
  type: SurveyItemType;
  required: boolean;
  condition: RoleCondition | "all";
  placeholder?: string;
  inputType?: "text" | "email";
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: string[];
  options?: string[];
  dependsOnItemId?: string;
  dependsOnValue?: string[];
};

export type SurveyTemplateId = "per_condition" | "post_study";

export type SurveyTemplate = {
  id: SurveyTemplateId;
  title: string;
  intro: string;
  items: SurveyItem[];
};

export type SessionEnvelope = {
  sessionId: string;
  participantId: string;
  status: SessionStatus;
  currentTrialIndex: number;
  currentState: StudyState;
  isPlayground: boolean;
};
