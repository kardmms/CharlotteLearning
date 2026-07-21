import { NextResponse } from "next/server";
import { deleteExpiredPrivacyData } from "@/lib/privacy-retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await deleteExpiredPrivacyData();
  return NextResponse.json({ ok: true, ...result });
}
