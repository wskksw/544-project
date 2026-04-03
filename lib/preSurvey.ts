import { CONSENT_OPTION_NO, CONSENT_OPTION_YES, CONSENT_QUESTION } from "@/components/study/consent";
import { visibleSurveyItems as filterVisibleSurveyItems } from "@/lib/surveyItems";
import type { SurveyItem } from "@/lib/types";

const ETHNICITY_OPTIONS = [
  "White (e.g., European origins)",
  "South Asian (e.g., Indian, Pakistani, Sri Lankan)",
  "Chinese",
  "Black (e.g., African American, African Canadian, Caribbean origins)",
  "Filipino",
  "Arab",
  "Latin American, Central or South American origins",
  "Southeast Asian (e.g., Vietnamese, Cambodian, Laotian, Thai)",
  "West Asian (e.g., Iranian, Afghan)",
  "Korean",
  "Japanese",
  "Indigenous (e.g., First Nation, Inuit, Metis, Alaska Native)",
  "Pacific Islander (e.g., Hawaiian, Samoan)",
  "Other (please specify)",
  "Prefer not to answer"
];

export const PRE_SURVEY_ITEMS: SurveyItem[] = [
  {
    id: "pre_consent",
    prompt: CONSENT_QUESTION,
    type: "radio",
    required: true,
    condition: "all",
    options: [CONSENT_OPTION_YES, CONSENT_OPTION_NO]
  },
  {
    id: "pre_full_name",
    prompt: "Full name",
    type: "short_text",
    required: true,
    condition: "all",
    placeholder: "First and last name"
  },
  {
    id: "pre_today_date",
    prompt: "Today's date (YYYY/MM/DD)",
    type: "short_text",
    required: true,
    condition: "all",
    placeholder: "2026/04/01"
  },
  {
    id: "pre_email",
    prompt: "Your email address",
    type: "short_text",
    required: true,
    condition: "all",
    placeholder: "name@example.com",
    inputType: "email"
  },
  {
    id: "pre_age_group",
    prompt: "In what age group are you?",
    type: "multiple_choice",
    required: true,
    condition: "all",
    options: ["18 and under", "20 - 29", "30 - 39", "40 - 49", "50 - 59", "60 +"]
  },
  {
    id: "pre_gender",
    prompt: "Gender",
    type: "multiple_choice",
    required: true,
    condition: "all",
    options: [
      "Man",
      "Woman",
      "Non-binary",
      "Prefer not to answer",
      "You don't have an option that applies to me"
    ]
  },
  {
    id: "pre_gender_self_describe",
    prompt: "You don't have an option that applies to me. I identify as",
    type: "short_text",
    required: false,
    condition: "all",
    placeholder: "Please specify",
    dependsOnItemId: "pre_gender",
    dependsOnValue: ["You don't have an option that applies to me"]
  },
  {
    id: "pre_ethnicity",
    prompt: "Ethnicity",
    type: "multiple_choice",
    required: true,
    condition: "all",
    options: ETHNICITY_OPTIONS
  },
  {
    id: "pre_ethnicity_other",
    prompt: "Other ethnicity",
    type: "short_text",
    required: false,
    condition: "all",
    placeholder: "Please specify",
    dependsOnItemId: "pre_ethnicity",
    dependsOnValue: ["Other (please specify)"]
  },
  {
    id: "pre_occupation",
    prompt: "In terms of your current occupation, how would you characterize yourself?",
    type: "multiple_choice",
    required: true,
    condition: "all",
    options: [
      "Writer",
      "Administrative Assistant",
      "Journalist",
      "Secretary",
      "Academic",
      "Professional",
      "Technical expert",
      "Student",
      "Designer",
      "Administrator/Manager",
      "Other"
    ]
  },
  {
    id: "pre_occupation_other",
    prompt: "Other occupation",
    type: "short_text",
    required: false,
    condition: "all",
    placeholder: "Please specify",
    dependsOnItemId: "pre_occupation",
    dependsOnValue: ["Other"]
  },
  {
    id: "pre_prior_ai_usage_frequency",
    prompt: "How often do you use AI writing tools (e.g., ChatGPT, Grammarly)?",
    type: "likert",
    required: true,
    condition: "all",
    scaleMin: 1,
    scaleMax: 5,
    scaleLabels: ["Never", "Rarely", "Monthly", "Weekly", "Daily"]
  },
  {
    id: "pre_ai_chatbot_writing_attitude",
    prompt: "How do you feel about using AI chatbots for writing?",
    type: "likert",
    required: true,
    condition: "all",
    scaleMin: 1,
    scaleMax: 7,
    scaleLabels: [
      "Very negative",
      "Negative",
      "Somewhat negative",
      "Neutral",
      "Somewhat positive",
      "Positive",
      "Very positive"
    ]
  },
  {
    id: "pre_writing_confidence",
    prompt: "I am confident in my ability to express my feelings in writing.",
    type: "likert",
    required: true,
    condition: "all",
    scaleMin: 1,
    scaleMax: 7,
    scaleLabels: [
      "Strongly disagree",
      "Disagree",
      "Somewhat disagree",
      "Neutral",
      "Somewhat agree",
      "Agree",
      "Strongly agree"
    ]
  },
  {
    id: "pre_followup_interview",
    prompt: "Would you be willing to participate in a follow-up interview?",
    type: "multiple_choice",
    required: true,
    condition: "all",
    options: ["Yes", "No"]
  }
];

export const WHEN2MEET_URL = "https://www.when2meet.com/?35925525-Lbjiy";

export function getTodayDateString(): string {
  const today = new Date();
  return `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}`;
}

export function getVisiblePreSurveyItems(answers: Record<string, unknown> = {}): SurveyItem[] {
  return filterVisibleSurveyItems(PRE_SURVEY_ITEMS, answers);
}

function isMissingRequiredValue(item: SurveyItem, value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim().length === 0;
  }
  if (typeof value === "number") {
    return Number.isNaN(value);
  }
  if (Array.isArray(value)) {
    const filtered = value.filter((entry) => typeof entry === "string" && entry.trim().length > 0);
    return filtered.length !== (item.options?.length ?? 0) || new Set(filtered).size !== filtered.length;
  }
  return true;
}

export function getMissingRequiredPreSurveyItemIds(answers: Record<string, unknown>): string[] {
  return getVisiblePreSurveyItems(answers)
    .filter((item) => item.required)
    .filter((item) => isMissingRequiredValue(item, answers[item.id]))
    .map((item) => item.id);
}

export function getPreSurveyValidationError(answers: Record<string, unknown>): string | null {
  const missing = getMissingRequiredPreSurveyItemIds(answers);
  if (missing.length > 0) {
    return "Please complete all required pre-survey fields.";
  }

  const email = typeof answers.pre_email === "string" ? answers.pre_email.trim() : "";
  if (!email || !email.includes("@")) {
    return "Please provide a valid email address so we can contact you about the optional interview.";
  }

  if (answers.pre_prior_ai_usage_frequency === 1) {
    return "Participants who have never used AI writing tools are not eligible for this study.";
  }

  if (answers.pre_consent !== CONSENT_OPTION_YES) {
    return "You must consent to participate before continuing to the practice round.";
  }

  return null;
}
