import {
  RESEARCHER_ACCESS_COOKIE_NAME,
  RESEARCHER_ACCESS_COOKIE_VALUE,
  isValidResearcherAccessCode
} from "@/lib/researcherAuth";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  accessCode: z.string().min(1)
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const parsed = bodySchema.parse(await request.json());
    const forwardedProto = request.headers.get("x-forwarded-proto") ?? "";
    const isHttpsRequest =
      forwardedProto
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .includes("https");

    if (!isValidResearcherAccessCode(parsed.accessCode)) {
      return NextResponse.json({ error: "Invalid researcher access code." }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(RESEARCHER_ACCESS_COOKIE_NAME, RESEARCHER_ACCESS_COOKIE_VALUE, {
      httpOnly: true,
      secure: isHttpsRequest,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
