import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAdminMetrics } from "@/lib/admin-metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  const metrics = await getAdminMetrics();
  return NextResponse.json(metrics, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
