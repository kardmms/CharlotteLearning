import { NextResponse } from "next/server";
import { sendWeeklyTeacherSummaries } from "@/lib/weekly-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendWeeklyTeacherSummaries();
  return NextResponse.json({ ok: true, ...result }, {
    headers: { "Cache-Control": "no-store" }
  });
}
