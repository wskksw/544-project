import { hasResearcherAccess, RESEARCHER_ACCESS_COOKIE_NAME } from "@/lib/researcherAuth";
import { NextRequest, NextResponse } from "next/server";

function isPublicResearcherPath(pathname: string): boolean {
  return pathname.startsWith("/researcher/login") || pathname.startsWith("/api/researcher/auth");
}

function buildNextPath(request: NextRequest): string {
  return `${request.nextUrl.pathname}${request.nextUrl.search}`;
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (isPublicResearcherPath(pathname)) {
    return NextResponse.next();
  }

  const cookieValue = request.cookies.get(RESEARCHER_ACCESS_COOKIE_NAME)?.value;
  if (hasResearcherAccess(cookieValue)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/researcher")) {
    return NextResponse.json({ error: "Researcher access code required." }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/researcher/login";
  loginUrl.searchParams.set("next", buildNextPath(request));
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/researcher/:path*", "/api/researcher/:path*", "/session/:path*"]
};
