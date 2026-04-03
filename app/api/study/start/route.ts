import { NextResponse } from "next/server";

export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    { error: "Study enrollment now requires consent and the pre-study survey before study access is assigned." },
    { status: 400 }
  );
}
