export type Condition = "thought_partner" | "editor" | "ghost_writer";

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

export type SurveyItem = {
  id: string;
  prompt: string;
  type: "likert" | "open_text" | "short_text" | "multiple_choice" | "radio" | "ranking";
  required: boolean;
  condition: Condition | "all";
  placeholder?: string;
  inputType?: "text" | "email";
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: string[];
  options?: string[];
  dependsOnItemId?: string;
  dependsOnValue?: string[];
};

export type SurveyTemplate = {
  id: "per_condition" | "post_study";
  title: string;
  intro: string;
  items: SurveyItem[];
};

export type SessionPayload = {
  session: {
    id: string;
    participantId: string;
    participantLabel: string;
    accessCode: string;
    isPlayground: boolean;
    status: "active" | "completed";
    currentTrialIndex: number;
    currentState: StudyState;
    followupInterviewOptIn: boolean;
  };
  currentTrial: {
    trial_index: number;
    scenario_id: string;
    condition: Condition;
    order_position: number;
    status: string;
    started_at: string | null;
    scenario: {
      id: string;
      title: string;
      description: string;
      requiredElements?: string[];
    };
  };
  allTrials: Array<{
    trial_index: number;
    scenario_id: string;
    condition: Condition;
    order_position: number;
    status: string;
  }>;
  conditionSurveyTemplate: SurveyTemplate;
  postStudySurveyTemplate: SurveyTemplate;
  completionCode: string;
};

export type Suggestion = {
  id: number;
  originalSegment: string;
  suggestedChange: string;
  category: "tone" | "specificity" | "empathy" | "clarity";
  reasonText: string;
};

export type ThoughtPartnerOutput = {
  reflectiveQuestions: Array<{
    dimension: "Own feelings" | "Recipient's perspective" | "Communication intent" | "Relational context";
    question: string;
  }>;
};

export type HighlightStatus = "accept" | "modify";

export type EditorHighlightRange = {
  id: number;
  start: number;
  end: number;
  status: HighlightStatus;
};

export type AiActivity =
  | "practice_nudge"
  | "ghost_writer_generate"
  | "editor_suggest"
  | "thought_partner_questions"
  | null;

export type PortalMode = "researcher" | "participant";

export type AiLoadingCopy = {
  eyebrow: string;
  title: string;
  detail: string;
};

export type BulletInputGuidance = {
  whatAiDoes: string[];
  tooltip: string;
  showExample: boolean;
  exampleTitle: string;
  exampleBullets: string[];
};
