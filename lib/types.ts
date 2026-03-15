export type RoleCondition = "drafter" | "revisor" | "facilitator";

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
  | "inter_condition_buffer";

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
  patternId: "P1" | "P2" | "P3";
  scenario1Order: RoleCondition[];
  scenario2Order: RoleCondition[];
};

export type SessionEnvelope = {
  sessionId: string;
  participantId: string;
  status: "active" | "completed";
  currentTrialIndex: number;
  currentState: StudyState;
  isPlayground: boolean;
};
