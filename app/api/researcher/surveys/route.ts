import { listSurveyTemplates, saveSurveyTemplates } from "@/lib/surveys";
import type { SurveyTemplate } from "@/lib/types";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  templates: z.array(z.unknown())
});

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ templates: listSurveyTemplates() });
}

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const parsed = bodySchema.parse(await request.json());
    const templates = saveSurveyTemplates(parsed.templates as SurveyTemplate[]);
    return NextResponse.json({ templates });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
