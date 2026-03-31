import { STUDY_MODEL } from "@/lib/constants";
import { z } from "zod";

export const editorSuggestionsSchema = z.object({
  suggestions: z
    .array(
      z.object({
        originalSegment: z.string().min(1),
        suggestedChange: z.string().min(1),
        category: z.enum(["tone", "specificity", "empathy", "clarity"]),
        reasonText: z.string().min(1)
      })
    )
    .length(4)
});

export const thoughtPartnerOutputSchema = z.object({
  reflectiveQuestions: z.array(z.string().min(1)).length(4)
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
  bullets: string[];
}): Promise<{ rawText: string; systemPrompt: string; userPrompt: string }> {
  const systemPrompt = `You are a message writing assistant. The user needs to send a message to a close friend named Alex. Based only on the key points they provided, write the message on their behalf.

Rules:
- Write in first person as if you are the user
- Length: 80–150 words
- Match the tone, emotional register, and level of polish implied by the user's bullet points
- Preserve likely human variation: the message should sound plausible and natural, not optimized, literary, or therapist-like
- Do NOT add information, motives, emotions, explanations, promises, or context that the user did not mention or clearly imply
- Do NOT include greetings like "Dear" or sign-offs like "Sincerely"
- The message should read like a real text message — natural, conversational, not overly literary
- Avoid generic conflict-resolution cliches, corporate phrasing, and exaggerated emotional language unless the bullets clearly support them
- Do NOT turn bullet fragments into facts if they are uncertain or ambiguous
- If the bullet points are vague or lack detail, write a restrained message using only what was provided — do not infer or elaborate beyond what the user stated

Return only the message text, nothing else.`;

  const userPrompt = `The user provided these key points:
"""
${params.bullets.map((b, i) => `${i + 1}. ${b.trim()}`).join("\n")}
"""

Write a complete message that the user could send to Alex via text or messaging app.`;

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
  message: string;
}): Promise<{
  parsed: z.infer<typeof editorSuggestionsSchema>;
  rawText: string;
  systemPrompt: string;
  userPrompt: string;
}> {
  const systemPrompt = `You are a message revision assistant. The user wrote a message to a close friend named Alex. Your job is to suggest improvements to how the message is expressed — not what it says.

Generate exactly 4 revision suggestions, one for each category below. For each, identify a specific sentence from the draft and provide a revised version.

Categories:
1. Tone — Is the emotional register appropriate for the situation and relationship?
2. Empathy — Does the message acknowledge the recipient's likely feelings or perspective?
3. Specificity — Could any vague statements be made more concrete or personal?
4. Clarity — Is the sender's intent legible? Will the recipient understand what the sender wants them to know, feel, or do?

Rules:
- Each "originalSegment" must be a COMPLETE SENTENCE copied verbatim from the draft — never a partial phrase
- Each "suggestedChange" must be a complete replacement sentence of similar scope
- Each suggestion must target a DIFFERENT sentence from the draft
- Preserve the user's voice and writing style — refine, do not rewrite
- Operate only on the expression layer: wording, tone, specificity, empathy, and clarity
- Do NOT introduce new content, motives, facts, promises, requests, or sentiments the user did not already include
- Do NOT use placeholders, bracketed advice, or meta-instructions inside the suggested sentence
- "reasonText" must be concise (under 20 words)
- If the draft is already strong in a category, suggest a subtle refinement rather than a major change
- If the draft is vague, work only with what is written — do not assume unstated details or emotions
- Avoid making the user sound unusually polished, formal, or emotionally articulate unless the draft already sounds that way

Return strict JSON matching this exact schema:
{"suggestions":[{"originalSegment":"...","suggestedChange":"...","category":"tone|empathy|specificity|clarity","reasonText":"..."}]}`;

  const userPrompt = `The user's draft:
"""
${params.message}
"""

Generate revision suggestions for this draft. Respond ONLY with the JSON object.`;

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
          category: "clarity" as const,
          reasonText: "The revision makes the intent and desired next step clearer."
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
  bullets: string[];
}): Promise<{
  parsed: z.infer<typeof thoughtPartnerOutputSchema>;
  rawText: string;
  systemPrompt: string;
  userPrompt: string;
}> {
  const systemPrompt = `You are a reflective thinking assistant. The user is about to write a message to a close friend named Alex. Before they write, help them think through what they want to say by asking reflective questions.

Generate exactly 4 reflective questions, one for each dimension below. Each question should be grounded in what the user shared — reference specific details from their bullet points when possible.

Dimensions (ask in this exact order):
1. Own feelings — Help the user identify what they are feeling about this situation
2. Recipient's perspective — Help the user consider how Alex might be feeling or experiencing the situation
3. Communication intent — Help the user clarify what they want Alex to feel or understand after reading the message
4. Relational context — Help the user reflect on why this situation matters for the friendship

Rules:
- Ask ONE question per dimension
- Each question must be open-ended (not yes/no)
- Keep questions short and conversational (under 25 words each)
- Do NOT give advice, suggestions, or opinions
- Do NOT reference the message they will write — focus only on their thoughts and feelings
- Do NOT tell the user what they should feel or what Alex might feel — ask them to explore it
- Do NOT propose wording, strategies, or next steps
- Do NOT moralize, diagnose, reassure, or steer the user toward reconciliation, confrontation, apology, gratitude, or any specific stance
- If the bullet points are vague or lack detail, ask questions that help the user surface the specifics themselves rather than assuming details

Return strict JSON matching this exact schema:
{"reflectiveQuestions":["...","...","...","..."]}`;

  const userPrompt = `The user described the situation:
"""
${params.bullets.map((b, i) => `${i + 1}. ${b.trim()}`).join("\n")}
"""

Generate reflective questions based on what the user shared. Respond ONLY with the JSON object.`;

  if (!process.env.OPENAI_API_KEY) {
    const fallback = {
      reflectiveQuestions: [
        "What are you feeling about this situation right now?",
        "How do you think Alex might be experiencing this?",
        "What do you most want Alex to feel or understand after reading your message?",
        "Why does this situation matter for your relationship with Alex?"
      ]
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

export async function generatePracticeNudge(params: {
  userMessage: string;
}): Promise<{ nudge: string; systemPrompt: string; userPrompt: string }> {
  const systemPrompt = `You are a message writing assistant. The user is replying to a friend's text that said: "Hey, want to grab lunch tomorrow?"

Your job: suggest ONE brief, casual addition they might want to include in their reply (e.g., a time, a place, a food preference).

Rules:
- Output ONLY the suggestion as a short question (under 15 words)
- Do NOT rewrite or edit their message
- Do NOT comment on their writing
- Keep the tone casual and friendly
- If their reply already covers everything, say "Looks good! Want to add anything else before sending?"`;

  const userPrompt = `The user wrote:
"""
${params.userMessage}
"""`;

  if (!process.env.OPENAI_API_KEY) {
    return {
      nudge: "Want to suggest a time or place?",
      systemPrompt,
      userPrompt
    };
  }

  const nudge = await callOpenAI(systemPrompt, userPrompt);
  return { nudge, systemPrompt, userPrompt };
}
