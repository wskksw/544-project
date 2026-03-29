export type RoleCondition = "drafter" | "revisor" | "facilitator";

export type SessionStatus = "active" | "completed";

export type StudyState =
  | "scenario_intro"
  | "bullet_input"
  | "human_drafting"
  | "ai_generation"
  | "ai_revision"
  | "reflection_questions"
  | "reflection_summary"
  | "independent_drafting"
  | "optional_feedback"
  | "final_edit"
  | "post_condition_survey"
  | "inter_condition_buffer"
  | "post_study_survey";

export type Scenario = {
  id: string;
  title: string;
  description: string;
  requiredElements: string[];
};

export type TrialPlan = {
  trialIndex: number;
  scenarioId: string;
  condition: RoleCondition;
  orderPosition: number;
  status: "pending" | "active" | "completed";
};

export type AssignmentCell = {
  cellId: string;
  scenarioFirst: "scenario_1" | "scenario_2";
  roleOrderId: string;
  conditionOrder: RoleCondition[];
};

export type SurveyItemType = "likert" | "open_text" | "multiple_choice";

export type SurveyItem = {
  id: string;
  prompt: string;
  type: SurveyItemType;
  required: boolean;
  condition: RoleCondition | "all";
  scaleMin?: number;
  scaleMax?: number;
  options?: string[];
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
