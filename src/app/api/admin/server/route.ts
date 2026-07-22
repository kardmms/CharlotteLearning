import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getVercelServerMetrics } from "@/lib/vercel-monitoring";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  const metrics = await getVercelServerMetrics();
  return NextResponse.json(metrics, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
