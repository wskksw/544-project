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

export const thoughtPartnerOutputSchema = z
  .array(
    z.object({
      dimension: z.enum([
        "Own feelings",
        "Recipient's perspective",
        "Communication intent",
        "Relational context"
      ]),
      question: z.string().min(1)
    })
  )
  .length(4);

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
    "I wanted to reach out about this.",
    "",
    ...bullets.map((bullet) => bullet.trim()).filter(Boolean),
    "",
    "I care about our friendship and wanted to be honest. If you're open to it, I'd like to talk soon."
  ].join("\n");
}

export async function generateGhostWriterDraft(params: {
  bullets: string[];
}): Promise<{ rawText: string; systemPrompt: string; userPrompt: string }> {
  const systemPrompt = `You are a message writing assistant. The user needs to send a message to a close friend. Based only on the key points they provided, write the message on their behalf.

Use only the bullet points provided in the user prompt. Do NOT use, infer, or reference any external scenario descriptions, templates, metadata, or study context.

Rules:
- Write in first person as if you are the user
- Length: 80–150 words
- Preserve likely human variation: the message should sound plausible and natural, not optimized, literary, or therapist-like
- Do NOT add information, motives, emotions, explanations, promises, or context that the user did not mention or clearly imply
- Do NOT include greetings like "Dear" or sign-offs like "Sincerely"
- The message should read like a real text message — natural, conversational, not overly literary
- If the bullet points are vague or lack detail, write a restrained message using only what was provided — do not infer or elaborate beyond what the user stated

Return only the message text, nothing else.`;

  const userPrompt = `The user provided these key points:
"""
${params.bullets.map((b, i) => `${i + 1}. ${b.trim()}`).join("\n")}
"""

Write a complete message that the user could send via text or messaging app.`;

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
  const systemPrompt = `You are a message revision assistant. The user wrote a message to a close friend. Suggest revisions based only on what is written in the draft.

Generate exactly 4 revision suggestions, one for each category below. For each suggestion, identify a specific sentence or phrase from the draft that could be improved, and provide a revised version.

Categories:
1. Tone: Is the emotional register appropriate for the situation and relationship?
2. Empathy: Does the message acknowledge the recipient's feelings or perspective?
3. Specificity: Could any vague statements be made more concrete or personal?
4. Clarity: Is the sender's intention or meaning clearly expressed?

Example:
If the user's draft were:
"Hey, I know things have been weird between us. I messed up and I feel bad about it. I hope we can move past this. You mean a lot to me."

Then the suggestions could be:
- Tone: original "I know things have been weird between us" -> suggested "I know things have been tense between us, and that's on me"
- Empathy: original "I hope we can move past this" -> suggested "I understand if you're not ready to move past this yet, but I hope we can talk"
- Specificity: original "I messed up and I feel bad about it" -> suggested "I feel bad about how I handled things, and you deserved better"
- Clarity: original "You mean a lot to me" -> suggested "I don't want this to affect our friendship — you mean a lot to me"

Rules:
- Each suggestion should revise a DIFFERENT part of the draft
- Reasons should be concise (under 20 words)
- If the draft is strong in a category, still suggest a subtle improvement
- Keep each category exactly one of: tone, empathy, specificity, clarity

Return strict JSON matching this exact schema:
{"suggestions":[{"originalSegment":"...","suggestedChange":"...","category":"tone|empathy|specificity|clarity","reasonText":"..."}]}`;

  const userPrompt = `The user's draft:
"""
${params.message}
"""

Now generate suggestions for the user's actual draft above. Respond ONLY with the JSON object.`;

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
  const systemPrompt = `You are a reflective writing assistant. The user is about to write a message to a close friend. Before they write, help them think through what they want to say by asking reflective questions.

The user described the situation in bullet points. Generate exactly 4 reflective questions, one for each dimension below. Each question should be grounded in what the user shared and reference specific details from their bullet points.

Dimensions (ask in this order):
Own feelings: Help the user put words to how they feel about this situation.
Recipient's perspective: Help the user step into the recipient's shoes — what might they be feeling, and what might they want to hear.
Communication intent: Help the user get specific about what they want the recipient to take away from the message, and why that matters.
Relational context: Help the user reflect on why this message matters and how it could affect the relationship. Focus on what might change depending on how they say it.
Rules:
- Ask ONE question per dimension
- Each question should be open-ended (not yes/no)
- Keep questions short and conversational (under 25 words)
- Questions should make the user pause and think, not just report facts they already know
- Do NOT give advice, suggestions, or opinions
- Do NOT reference the message they will write — focus only on their thoughts and feelings
- If the bullet points are vague, ask questions that help the user surface the specifics themselves

Respond in this exact JSON format:
[
  {
    "dimension": "Own feelings",
    "question": "<your question>"
  },
  {
    "dimension": "Recipient's perspective",
    "question": "<your question>"
  },
  {
    "dimension": "Communication intent",
    "question": "<your question>"
  },
  {
    "dimension": "Relational context",
    "question": "<your question>"
  }
]`;

  const userPrompt = `The user described the situation:
"""
${params.bullets.map((b, i) => `${i + 1}. ${b.trim()}`).join("\n")}
"""

Generate reflective questions based on what the user shared. Respond ONLY with the JSON array.`;

  if (!process.env.OPENAI_API_KEY) {
    const fallback = [
      {
        dimension: "Own feelings" as const,
        question: "What emotions are strongest for you in this situation right now?"
      },
      {
        dimension: "Recipient's perspective" as const,
        question: "How might the other person be experiencing what happened from their side?"
      },
      {
        dimension: "Communication intent" as const,
        question: "What do you most want them to feel or understand after hearing from you?"
      },
      {
        dimension: "Relational context" as const,
        question: "Why does this situation matter for your relationship with them?"
      }
    ];

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
