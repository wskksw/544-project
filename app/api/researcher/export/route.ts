import { exportAllData } from "@/lib/sessionManager";
import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ exportedAt: new Date().toISOString(), data: exportAllData() });
}
