export const RESEARCHER_ACCESS_CODE = "2026AIMC";
export const RESEARCHER_ACCESS_COOKIE_NAME = "researcher_access";
export const RESEARCHER_ACCESS_COOKIE_VALUE = "granted";

export function isValidResearcherAccessCode(accessCode: string): boolean {
  return accessCode.trim() === RESEARCHER_ACCESS_CODE;
}

export function hasResearcherAccess(cookieValue: string | undefined): boolean {
  return cookieValue === RESEARCHER_ACCESS_COOKIE_VALUE;
}
