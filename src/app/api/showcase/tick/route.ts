import { NextResponse } from "next/server";
import { getTeacherContext } from "@/lib/auth";
import { runShowcaseTick } from "@/lib/showcase";
import { assertSameOrigin, isSameOriginError } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getTeacherContext();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!session.showcase) return NextResponse.json({ error: "Showcase session required" }, { status: 403 });

    const result = await runShowcaseTick(session.sub, session.schoolId);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    if (isSameOriginError(error)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Showcase simulation tick failed", error);
    return NextResponse.json({ error: "Showcase simulation could not advance" }, { status: 500 });
  }
}
