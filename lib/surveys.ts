import { db } from "@/lib/db";
import { nowIso } from "@/lib/logger";
import { visibleSurveyItems as filterVisibleSurveyItems } from "@/lib/surveyItems";
import type { RoleCondition, SurveyItem, SurveyTemplate, SurveyTemplateId } from "@/lib/types";
import { z } from "zod";

const surveyItemSchema = z
  .object({
    id: z.string().min(1),
    prompt: z.string().min(1),
    type: z.enum(["likert", "open_text", "short_text", "multiple_choice", "ranking"]),
    required: z.boolean().default(true),
    condition: z.enum(["all", "thought_partner", "editor", "ghost_writer"]).default("all"),
    placeholder: z.string().min(1).optional(),
    inputType: z.enum(["text", "email"]).optional(),
    scaleMin: z.number().int().min(1).max(21).optional(),
    scaleMax: z.number().int().min(1).max(21).optional(),
    scaleLabels: z.array(z.string().min(1)).optional(),
    options: z.array(z.string().min(1)).optional(),
    dependsOnItemId: z.string().min(1).optional(),
    dependsOnValue: z.array(z.string().min(1)).min(1).optional()
  })
  .superRefine((item, ctx) => {
    if (item.type === "likert") {
      if (item.scaleMin === undefined || item.scaleMax === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Likert items need scaleMin and scaleMax." });
      }
      if (item.scaleMin !== undefined && item.scaleMax !== undefined && item.scaleMin >= item.scaleMax) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Likert scaleMin must be less than scaleMax." });
      }
      if (
        item.scaleMin !== undefined &&
        item.scaleMax !== undefined &&
        item.scaleLabels !== undefined &&
        item.scaleLabels.length !== item.scaleMax - item.scaleMin + 1
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Likert scaleLabels length must match the number of points in the scale."
        });
      }
    }

    if ((item.type === "multiple_choice" || item.type === "ranking") && (!item.options || item.options.length < 2)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${item.type} items need at least two options.` });
    }

    if ((item.dependsOnItemId && !item.dependsOnValue) || (!item.dependsOnItemId && item.dependsOnValue)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Dependent survey items need both dependsOnItemId and dependsOnValue."
      });
    }
  });

const surveyTemplateSchema = z.object({
  id: z.enum(["per_condition", "post_study"]),
  title: z.string().min(1),
  intro: z.string().min(1),
  items: z.array(surveyItemSchema).min(1)
});

const surveyTemplateListSchema = z.array(surveyTemplateSchema).length(2);

const CONDITION_OPTIONS = [
  "The tool that asked you reflection questions before you wrote",
  "The tool that suggested revisions to your draft",
  "The tool that generated a draft from your bullet points"
];
const AGREEMENT_SCALE_LABELS = [
  "Strongly disagree",
  "Disagree",
  "Somewhat disagree",
  "Neutral",
  "Somewhat agree",
  "Agree",
  "Strongly agree"
];
const HIGH_LOW_SCALE_LABELS = [
  "Very low",
  "Low",
  "Somewhat low",
  "Neutral",
  "Somewhat high",
  "High",
  "Very high"
];
const CONTRIBUTION_SCALE_LABELS = [
  "Not at all",
  "A little",
  "A small amount",
  "A moderate amount",
  "A fair amount",
  "A lot",
  "A great deal"
];

const DEFAULT_TEMPLATES: SurveyTemplate[] = [
  {
    id: "per_condition",
    title: "Post-Condition Survey",
    intro: "Rate the message you just completed before moving to the next study block.",
    items: [
      {
        id: "sender_authenticity_genuine_thoughts_feelings",
        prompt: "This message reflects my genuine thoughts and feelings.",
        type: "likert",
        required: true,
        condition: "all",
        scaleMin: 1,
        scaleMax: 7,
        scaleLabels: AGREEMENT_SCALE_LABELS
      },
      {
        id: "sender_authenticity_authentic_voice",
        prompt: "This message preserves my authentic voice as a communicator.",
        type: "likert",
        required: true,
        condition: "all",
        scaleMin: 1,
        scaleMax: 7,
        scaleLabels: AGREEMENT_SCALE_LABELS
      },
      {
        id: "sender_authenticity_stand_behind_message",
        prompt: "I could comfortably stand behind this message as representative of me.",
        type: "likert",
        required: true,
        condition: "all",
        scaleMin: 1,
        scaleMax: 7,
        scaleLabels: AGREEMENT_SCALE_LABELS
      },
      {
        id: "manip_ai_helped_what_to_say",
        prompt: "How much did the AI contribute to the final message?",
        type: "likert",
        required: true,
        condition: "all",
        scaleMin: 1,
        scaleMax: 7,
        scaleLabels: CONTRIBUTION_SCALE_LABELS
      },
      {
        id: "manip_ai_helped_how_to_say_it",
        prompt: "What was the main role of the AI in this task?",
        type: "multiple_choice",
        required: true,
        condition: "all",
        options: [
          "Helping me think about what to say",
          "Helping me refine how to say it",
          "Generating the message for me",
          "Other"
        ]
      },
      {
        id: "manip_text_mostly_written_by_me",
        prompt: "If you selected Other, please specify. (optional)",
        type: "open_text",
        required: false,
        condition: "all",
        dependsOnItemId: "manip_ai_helped_how_to_say_it",
        dependsOnValue: ["Other"]
      },
      {
        id: "effort_mental_demand",
        prompt: "How mentally demanding was this condition?",
        type: "likert",
        required: true,
        condition: "all",
        scaleMin: 1,
        scaleMax: 7,
        scaleLabels: HIGH_LOW_SCALE_LABELS
      },
      {
        id: "effort_effort",
        prompt: "How hard did you have to work to complete this condition?",
        type: "likert",
        required: true,
        condition: "all",
        scaleMin: 1,
        scaleMax: 7,
        scaleLabels: HIGH_LOW_SCALE_LABELS
      },
      {
        id: "effort_frustration",
        prompt: "How frustrated, stressed, or annoyed did you feel during this condition?",
        type: "likert",
        required: true,
        condition: "all",
        scaleMin: 1,
        scaleMax: 7,
        scaleLabels: HIGH_LOW_SCALE_LABELS
      },
      {
        id: "satisfaction_willing_to_send",
        prompt: "I would feel comfortable sending this message to my friend in a real-life situation.",
        type: "likert",
        required: true,
        condition: "all",
        scaleMin: 1,
        scaleMax: 7,
        scaleLabels: AGREEMENT_SCALE_LABELS
      }
    ]
  },
  {
    id: "post_study",
    title: "Post-Study Survey",
    intro: "These final questions compare the three AI tools after all study blocks are complete.",
    items: [
      {
        id: "overall_preference_ranking",
        prompt: "Rank the three tools from most preferred to least preferred.",
        type: "ranking",
        required: true,
        condition: "all",
        options: CONDITION_OPTIONS
      },
      {
        id: "overall_preference_rationale",
        prompt: "Why did you rank them this way? (1-2 sentences)",
        type: "open_text",
        required: false,
        condition: "all"
      }
    ]
  }
];

function cloneDefaultTemplates(): SurveyTemplate[] {
  return DEFAULT_TEMPLATES.map((template) => ({
    ...template,
    items: template.items.map((item) => ({
      ...item,
      scaleLabels: item.scaleLabels ? [...item.scaleLabels] : undefined,
      options: item.options ? [...item.options] : undefined,
      dependsOnValue: item.dependsOnValue ? [...item.dependsOnValue] : undefined
    }))
  }));
}

function normalizeTemplate(template: SurveyTemplate): SurveyTemplate {
  return surveyTemplateSchema.parse(template);
}

function normalizeTemplateList(templates: SurveyTemplate[]): SurveyTemplate[] {
  const parsed = surveyTemplateListSchema.parse(templates);
  const sorted = [...parsed].sort((a, b) => a.id.localeCompare(b.id));
  if (sorted[0].id !== "per_condition" || sorted[1].id !== "post_study") {
    throw new Error("Templates must include both per_condition and post_study.");
  }
  return sorted;
}

export function ensureSurveyTemplatesSeeded(): void {
  const timestamp = nowIso();
  const insert = db.prepare(
    "INSERT OR IGNORE INTO survey_templates (template_id, template_json, updated_at) VALUES (?, ?, ?)"
  );

  for (const template of DEFAULT_TEMPLATES) {
    insert.run(template.id, JSON.stringify(template), timestamp);
  }
}

export function getSurveyTemplate(templateId: SurveyTemplateId): SurveyTemplate {
  ensureSurveyTemplatesSeeded();

  const row = db
    .prepare("SELECT template_json FROM survey_templates WHERE template_id = ?")
    .get(templateId) as { template_json: string } | undefined;

  if (!row) {
    const fallback = DEFAULT_TEMPLATES.find((template) => template.id === templateId);
    if (!fallback) {
      throw new Error(`Template not found: ${templateId}`);
    }
    return fallback;
  }

  return normalizeTemplate(JSON.parse(row.template_json) as SurveyTemplate);
}

export function listSurveyTemplates(): SurveyTemplate[] {
  ensureSurveyTemplatesSeeded();

  const rows = db
    .prepare("SELECT template_json FROM survey_templates ORDER BY template_id")
    .all() as Array<{ template_json: string }>;

  const templates = rows.map((row) => normalizeTemplate(JSON.parse(row.template_json) as SurveyTemplate));
  return normalizeTemplateList(templates);
}

export function saveSurveyTemplates(templates: SurveyTemplate[]): SurveyTemplate[] {
  const normalized = normalizeTemplateList(templates);
  const timestamp = nowIso();

  db.transaction(() => {
    db.prepare("DELETE FROM survey_templates").run();
    const insert = db.prepare("INSERT INTO survey_templates (template_id, template_json, updated_at) VALUES (?, ?, ?)");
    for (const template of normalized) {
      insert.run(template.id, JSON.stringify(template), timestamp);
    }
  })();

  return normalized;
}

export function resetSurveyTemplatesToDefaults(): SurveyTemplate[] {
  return saveSurveyTemplates(cloneDefaultTemplates());
}

export function visibleSurveyItems(
  template: SurveyTemplate,
  answers: Record<string, unknown> = {},
  condition?: RoleCondition
): SurveyItem[] {
  return filterVisibleSurveyItems(template.items, answers, condition);
}
