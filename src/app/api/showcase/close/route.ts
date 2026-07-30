import { NextResponse } from "next/server";
import { getTeacherSession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/security";
import { scheduleShowcaseCleanup } from "@/lib/showcase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  assertSameOrigin(request);
  const session = await getTeacherSession();
  if (session?.showcase) await scheduleShowcaseCleanup(session.sub);
  return new NextResponse(null, { status: 204 });
}
