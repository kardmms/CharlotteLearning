import { NextResponse } from "next/server";
import { removeExpiredShowcaseWorkspaces } from "@/lib/showcase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await removeExpiredShowcaseWorkspaces();
  return NextResponse.json({ ok: true, deleted: result.count });
}
