import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getOpenAiUsageMetrics } from "@/lib/openai-usage";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  const metrics = await getOpenAiUsageMetrics();
  return NextResponse.json(metrics, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
