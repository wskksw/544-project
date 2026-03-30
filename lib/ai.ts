import { STUDY_MODEL } from "@/lib/constants";
import type { Scenario } from "@/lib/types";
import { z } from "zod";

export const editorSuggestionsSchema = z.object({
  suggestions: z
    .array(
      z.object({
        originalSegment: z.string().min(1),
        suggestedChange: z.string().min(1),
        category: z.enum(["tone", "specificity", "empathy", "closing_next_step"]),
        reasonText: z.string().min(1)
      })
    )
    .length(4)
});

export const thoughtPartnerOutputSchema = z.object({
  reflectiveQuestions: z.array(z.string().min(1)).length(4),
  summary: z.string().min(1)
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

function mockGhostWriterDraft(bullets: string[]): string {
  return [
    "Hey Alex,",
    "",
    ...bullets.map((bullet) => `- ${bullet.trim()}`),
    "",
    "I care about our friendship and wanted to reach out honestly. Can we talk soon?"
  ].join("\n");
}

export async function generateGhostWriterDraft(params: {
  scenario: Scenario;
  bullets: string[];
}): Promise<{ rawText: string; systemPrompt: string; userPrompt: string }> {
  const systemPrompt = [
    "You are AI Ghost-writer for an interpersonal communication study.",
    "Write one personal message using only the participant's bullet points.",
    "Include the required scenario elements and preserve relational sensitivity.",
    "Do not introduce new facts that are not reasonably implied by the participant bullets or scenario.",
    "Return only the final draft message.",
    "Target 100-150 words."
  ].join(" ");

  const userPrompt = [
    `Scenario: ${params.scenario.title}`,
    params.scenario.description,
    `Required elements: ${params.scenario.requiredElements.join(" | ")}`,
    `Participant bullets: ${params.bullets.join(" | ")}`
  ].join("\n\n");

  if (!process.env.OPENAI_API_KEY) {
    return {
      rawText: mockGhostWriterDraft(params.bullets),
      systemPrompt,
      userPrompt
    };
  }

  const rawText = await callOpenAI(systemPrompt, userPrompt);
  return { rawText, systemPrompt, userPrompt };
}

export async function generateEditorSuggestions(params: {
  scenario: Scenario;
  message: string;
}): Promise<{
  parsed: z.infer<typeof editorSuggestionsSchema>;
  rawText: string;
  systemPrompt: string;
  userPrompt: string;
}> {
  const systemPrompt = [
    "You are AI Editor for an interpersonal communication study.",
    "Return exactly four revision suggestions for the participant's message.",
    "The four categories must be: tone, specificity, empathy, closing_next_step.",
    "Revise wording only. Preserve the participant's underlying intent.",
    "Do not introduce new factual claims beyond what is already in the draft or clearly implied by the scenario.",
    "IMPORTANT: originalSegment must be a complete sentence (or the full clause up to terminal punctuation) copied verbatim from the draft — never a partial phrase.",
    "suggestedChange must be a complete replacement sentence of the same scope.",
    "Return strict JSON with this exact schema:",
    '{"suggestions":[{"originalSegment":"<full sentence from draft>","suggestedChange":"<full replacement sentence>","category":"tone|specificity|empathy|closing_next_step","reasonText":"..."}]}'
  ].join(" ");

  const userPrompt = [
    `Scenario: ${params.scenario.title}`,
    `Required elements: ${params.scenario.requiredElements.join(" | ")}`,
    `Draft message:\n${params.message}`
  ].join("\n\n");

  if (!process.env.OPENAI_API_KEY) {
    const fallback = {
      suggestions: [
        {
          originalSegment: "I'm sorry I missed it.",
          suggestedChange: "I'm really sorry I missed your housewarming.",
          category: "tone" as const,
          reasonText: "The revision sounds more sincere and direct."
        },
        {
          originalSegment: "I had a long day.",
          suggestedChange: "I got home late after an exhausting workday and handled it badly.",
          category: "specificity" as const,
          reasonText: "The revision explains the situation more concretely without sounding evasive."
        },
        {
          originalSegment: "I know this wasn't great.",
          suggestedChange: "I can imagine my silence and absence may have felt hurtful or disappointing.",
          category: "empathy" as const,
          reasonText: "The revision more clearly acknowledges the other person's likely feelings."
        },
        {
          originalSegment: "Can we talk soon?",
          suggestedChange: "If you're open to it, I'd really like to talk this week and try to make this right.",
          category: "closing_next_step" as const,
          reasonText: "The revision ends with a clearer, more actionable repair step."
        }
      ]
    };

    return {
      parsed: editorSuggestionsSchema.parse(fallback),
      rawText: JSON.stringify(fallback),
      systemPrompt,
      userPrompt
    };
  }

  const rawText = await callOpenAI(systemPrompt, userPrompt);
  const parsed = editorSuggestionsSchema.parse(safeJsonParse(rawText));
  return { parsed, rawText, systemPrompt, userPrompt };
}

export async function generateThoughtPartnerOutput(params: {
  scenario: Scenario;
  bullets: string[];
  reflections?: Array<{ question: string; response: string }>;
  requestType: "questions" | "summary";
}): Promise<{
  parsed: z.infer<typeof thoughtPartnerOutputSchema>;
  rawText: string;
  systemPrompt: string;
  userPrompt: string;
}> {
  const systemPrompt =
    params.requestType === "questions"
      ? [
        "You are AI Thought Partner for an interpersonal communication study.",
        "You may help the participant reflect, but you must not provide sendable message text.",
        "Return exactly four structured reflection questions that help clarify feelings, intentions, recipient perspective, and a concrete next step.",
        "Return strict JSON with this exact schema:",
        '{"reflectiveQuestions":["...","...","...","..."],"summary":"..."}',
        "For question generation, set summary to a short placeholder sentence."
      ].join(" ")
      : [
        "You are AI Thought Partner for an interpersonal communication study.",
        "You must not add advice, new content, or wording suggestions.",
        "Write a short mirror-style summary that only reflects back the participant's stated reflections.",
        "Return strict JSON with this exact schema:",
        '{"reflectiveQuestions":["...","...","...","..."],"summary":"..."}',
        "For summary generation, keep the reflectiveQuestions array identical to the original four questions provided by the user."
      ].join(" ");

  const reflectionBlock = params.reflections?.length
    ? params.reflections.map((item, index) => `${index + 1}. Q: ${item.question}\nA: ${item.response}`).join("\n")
    : "None";

  const userPrompt = [
    `Scenario: ${params.scenario.title}`,
    params.scenario.description,
    `Required elements: ${params.scenario.requiredElements.join(" | ")}`,
    `Initial bullets: ${params.bullets.join(" | ")}`,
    `Request type: ${params.requestType}`,
    `Reflections:\n${reflectionBlock}`
  ].join("\n\n");

  if (!process.env.OPENAI_API_KEY) {
    const fallback =
      params.requestType === "questions"
        ? {
          reflectiveQuestions: [
            "What do you most want Alex to understand about what happened?",
            "What emotion do you think Alex may be feeling right now?",
            "What do you hope Alex feels after reading your message?",
            "What concrete next step would help repair the relationship?"
          ],
          summary: "You are reflecting on what happened and what you want Alex to understand."
        }
        : {
          reflectiveQuestions: params.reflections?.map((item) => item.question).slice(0, 4) ?? [
            "What do you most want Alex to understand about what happened?",
            "What emotion do you think Alex may be feeling right now?",
            "What do you hope Alex feels after reading your message?",
            "What concrete next step would help repair the relationship?"
          ],
          summary:
            "You want to be honest about what happened, acknowledge Alex's likely feelings, and reach out in a way that feels caring and accountable."
        };

    return {
      parsed: thoughtPartnerOutputSchema.parse(fallback),
      rawText: JSON.stringify(fallback),
      systemPrompt,
      userPrompt
    };
  }

  const rawText = await callOpenAI(systemPrompt, userPrompt);
  const parsed = thoughtPartnerOutputSchema.parse(safeJsonParse(rawText));
  return { parsed, rawText, systemPrompt, userPrompt };
}
