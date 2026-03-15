import { STUDY_MODEL } from "@/lib/constants";
import type { Scenario } from "@/lib/types";
import { z } from "zod";

export const revisorSuggestionsSchema = z.object({
  suggestions: z
    .array(
      z.object({
        originalSegment: z.string().min(1),
        suggestedChange: z.string().min(1),
        reasonTag: z.enum(["tone", "clarity", "empathy"])
      })
    )
    .min(1)
    .max(12)
});

export const facilitatorOutputSchema = z.object({
  reflectiveQuestions: z.array(z.string().min(1)).min(3).max(6),
  summary: z.string().min(1),
  inferredRecipientPerspective: z.string().min(1),
  emotionalGoal: z.string().min(1),
  thingsToAvoid: z.array(z.string().min(1)).min(1),
  concreteNextStep: z.string().min(1),
  reminderChecklist: z.array(z.string().min(1)).min(2),
  highLevelFeedback: z.array(z.string().min(1)).max(6).optional()
});

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: STUDY_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
  };

  const firstContent = payload.choices?.[0]?.message?.content;
  if (typeof firstContent === "string") {
    return firstContent;
  }

  if (Array.isArray(firstContent)) {
    return firstContent
      .map((item) => (typeof item === "object" && item && "text" in item ? item.text ?? "" : ""))
      .join("\n")
      .trim();
  }

  throw new Error("No response content from OpenAI.");
}

function mockDraftFromBullets(bullets: string[]): string {
  return `Hi,\n\n${bullets
    .map((bullet) => `- ${bullet.trim()}`)
    .join("\n")}\n\nI wanted to share this clearly and respectfully. Let me know what you think.\n\nThanks.`;
}

export async function generateDrafterDraft(params: {
  scenario: Scenario;
  bullets: string[];
}): Promise<{ rawText: string; systemPrompt: string; userPrompt: string }> {
  const systemPrompt = [
    "You are AI Drafter for an interpersonal communication study.",
    "Write one personal message using only the participant's bullet points.",
    "Include required scenario elements, preserve relational sensitivity, and do not introduce new facts.",
    "Return only the draft message, 90-150 words."
  ].join(" ");

  const userPrompt = [
    `Scenario: ${params.scenario.title}`,
    params.scenario.description,
    `Required elements: ${params.scenario.requiredElements.join(" | ")}`,
    `Bullets: ${params.bullets.join(" | ")}`
  ].join("\n");

  if (!process.env.OPENAI_API_KEY) {
    return {
      rawText: mockDraftFromBullets(params.bullets),
      systemPrompt,
      userPrompt
    };
  }

  const rawText = await callOpenAI(systemPrompt, userPrompt);
  return { rawText, systemPrompt, userPrompt };
}

export async function generateRevisorSuggestions(params: {
  scenario: Scenario;
  message: string;
}): Promise<{
  parsed: z.infer<typeof revisorSuggestionsSchema>;
  rawText: string;
  systemPrompt: string;
  userPrompt: string;
}> {
  const systemPrompt = [
    "You are AI Revisor for an interpersonal communication study.",
    "Revise only tone, clarity, and empathy while preserving original intent.",
    "Do not introduce new factual content.",
    "Return JSON with this exact schema:",
    '{"suggestions":[{"originalSegment":"...","suggestedChange":"...","reasonTag":"tone|clarity|empathy"}]}'
  ].join(" ");

  const userPrompt = [
    `Scenario: ${params.scenario.title}`,
    `Required elements: ${params.scenario.requiredElements.join(" | ")}`,
    `Draft message:\n${params.message}`
  ].join("\n");

  if (!process.env.OPENAI_API_KEY) {
    const fallback = {
      suggestions: [
        {
          originalSegment: params.message.slice(0, Math.min(80, params.message.length)) || "Draft opening",
          suggestedChange: "Use a softer opening that acknowledges the other person's perspective.",
          reasonTag: "empathy" as const
        }
      ]
    };
    return {
      parsed: revisorSuggestionsSchema.parse(fallback),
      rawText: JSON.stringify(fallback),
      systemPrompt,
      userPrompt
    };
  }

  const rawText = await callOpenAI(systemPrompt, userPrompt);
  const parsedJson = safeJsonParse(rawText);
  const parsed = revisorSuggestionsSchema.parse(parsedJson);

  return { parsed, rawText, systemPrompt, userPrompt };
}

export async function generateFacilitatorOutput(params: {
  scenario: Scenario;
  bullets: string[];
  reflections?: Array<{ question: string; response: string }>;
  requestType: "questions" | "summary" | "feedback";
  draftMessage?: string;
}): Promise<{
  parsed: z.infer<typeof facilitatorOutputSchema>;
  rawText: string;
  systemPrompt: string;
  userPrompt: string;
}> {
  const systemPrompt = [
    "You are AI Facilitator for an interpersonal communication study.",
    "Never produce sendable sentence-level or paragraph-level message text.",
    "Allowed outputs: reflective questions, summaries, planning reminders, high-level feedback only.",
    "Respond strictly as JSON with schema:",
    '{"reflectiveQuestions":["..."],"summary":"...","inferredRecipientPerspective":"...","emotionalGoal":"...","thingsToAvoid":["..."],"concreteNextStep":"...","reminderChecklist":["..."],"highLevelFeedback":["..."]}'
  ].join(" ");

  const reflectionBlock = params.reflections?.length
    ? params.reflections.map((item, idx) => `${idx + 1}. Q: ${item.question}\nA: ${item.response}`).join("\n")
    : "None";

  const userPrompt = [
    `Scenario: ${params.scenario.title}`,
    params.scenario.description,
    `Required elements: ${params.scenario.requiredElements.join(" | ")}`,
    `Initial bullets: ${params.bullets.join(" | ")}`,
    `Request type: ${params.requestType}`,
    `Reflections:\n${reflectionBlock}`,
    params.draftMessage ? `Current user draft:\n${params.draftMessage}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");

  if (!process.env.OPENAI_API_KEY) {
    const fallback = {
      reflectiveQuestions: [
        "What might the recipient be feeling right now?",
        "What relationship outcome matters most to you after this message?",
        "Which one concrete next step will make your intent clear?"
      ],
      summary: "You want to acknowledge impact, stay respectful, and propose a specific next step.",
      inferredRecipientPerspective: "They may feel hurt or uncertain about your intent.",
      emotionalGoal: "Repair trust while staying accountable.",
      thingsToAvoid: ["Defensiveness", "Vague apologies without a next step"],
      concreteNextStep: "Invite a short follow-up conversation and suggest a time.",
      reminderChecklist: [
        "Name the specific event clearly",
        "Acknowledge impact",
        "State intention for repair",
        "Ask for a concrete follow-up"
      ],
      highLevelFeedback:
        params.requestType === "feedback"
          ? ["Keep the tone accountable and specific.", "Ensure the next step is explicit."]
          : undefined
    };

    return {
      parsed: facilitatorOutputSchema.parse(fallback),
      rawText: JSON.stringify(fallback),
      systemPrompt,
      userPrompt
    };
  }

  const rawText = await callOpenAI(systemPrompt, userPrompt);
  const parsedJson = safeJsonParse(rawText);
  const parsed = facilitatorOutputSchema.parse(parsedJson);

  return { parsed, rawText, systemPrompt, userPrompt };
}
