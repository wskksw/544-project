import { db } from "@/lib/db";
import { nowIso } from "@/lib/logger";
import type { RoleCondition, SurveyItem, SurveyTemplate, SurveyTemplateId } from "@/lib/types";
import { z } from "zod";

const surveyItemSchema = z
  .object({
    id: z.string().min(1),
    prompt: z.string().min(1),
    type: z.enum(["likert", "open_text", "multiple_choice"]),
    required: z.boolean().default(true),
    condition: z.enum(["all", "drafter", "revisor", "facilitator"]).default("all"),
    scaleMin: z.number().int().min(1).max(11).optional(),
    scaleMax: z.number().int().min(1).max(11).optional(),
    options: z.array(z.string().min(1)).optional()
  })
  .superRefine((item, ctx) => {
    if (item.type === "likert") {
      if (item.scaleMin === undefined || item.scaleMax === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Likert items need scaleMin and scaleMax." });
      }
      if (item.scaleMin !== undefined && item.scaleMax !== undefined && item.scaleMin >= item.scaleMax) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Likert scaleMin must be less than scaleMax." });
      }
    }

    if (item.type === "multiple_choice" && (!item.options || item.options.length < 2)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Multiple choice items need at least two options." });
    }
  });

const surveyTemplateSchema = z.object({
  id: z.enum(["per_condition", "post_study"]),
  title: z.string().min(1),
  intro: z.string().min(1),
  items: z.array(surveyItemSchema).min(1)
});

const surveyTemplateListSchema = z.array(surveyTemplateSchema).length(2);

const DEFAULT_TEMPLATES: SurveyTemplate[] = [
  {
    id: "per_condition",
    title: "Post-Condition Survey",
    intro: "Rate this just-completed condition before moving to the next one.",
    items: [
      {
        id: "authenticity_voice",
        prompt: "This message reflects my own voice.",
        type: "likert",
        required: true,
        condition: "all",
        scaleMin: 1,
        scaleMax: 7
      },
      {
        id: "effort_mental",
        prompt: "Mental demand during this condition was high.",
        type: "likert",
        required: true,
        condition: "all",
        scaleMin: 1,
        scaleMax: 7
      },
      {
        id: "satisfaction_result",
        prompt: "I am satisfied with the final message quality in this condition.",
        type: "likert",
        required: true,
        condition: "all",
        scaleMin: 1,
        scaleMax: 7
      },
      {
        id: "condition_comment",
        prompt: "Optional comment about this condition.",
        type: "open_text",
        required: false,
        condition: "all"
      }
    ]
  },
  {
    id: "post_study",
    title: "Post-Study Survey",
    intro: "Final questions after all condition blocks are complete.",
    items: [
      {
        id: "preferred_condition",
        prompt: "Which AI role did you prefer overall?",
        type: "multiple_choice",
        required: true,
        condition: "all",
        options: ["drafter", "revisor", "facilitator"]
      },
      {
        id: "overall_authenticity",
        prompt: "Across all conditions, which felt most authentic and why?",
        type: "open_text",
        required: true,
        condition: "all"
      },
      {
        id: "overall_feedback",
        prompt: "Any additional reflections for the research team?",
        type: "open_text",
        required: false,
        condition: "all"
      }
    ]
  }
];

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
  const count = db.prepare("SELECT COUNT(*) as count FROM survey_templates").get() as { count: number };
  if (count.count > 0) {
    return;
  }

  const insert = db.prepare(
    "INSERT INTO survey_templates (template_id, template_json, updated_at) VALUES (?, ?, ?)"
  );
  const timestamp = nowIso();

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
    const insert = db.prepare(
      "INSERT INTO survey_templates (template_id, template_json, updated_at) VALUES (?, ?, ?)"
    );
    for (const template of normalized) {
      insert.run(template.id, JSON.stringify(template), timestamp);
    }
  })();

  return normalized;
}

export function visibleSurveyItems(template: SurveyTemplate, condition?: RoleCondition): SurveyItem[] {
  if (!condition) {
    return template.items;
  }
  return template.items.filter((item) => item.condition === "all" || item.condition === condition);
}
