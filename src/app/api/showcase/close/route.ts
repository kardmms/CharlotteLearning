import { NextResponse } from "next/server";
import { getTeacherSession } from "@/lib/auth";
import { assertSameOrigin, isSameOriginError } from "@/lib/security";
import { scheduleShowcaseCleanup } from "@/lib/showcase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    if (isSameOriginError(error)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw error;
  }
  const session = await getTeacherSession();
  if (session?.showcase) await scheduleShowcaseCleanup(session.sub);
  return new NextResponse(null, { status: 204 });
}
