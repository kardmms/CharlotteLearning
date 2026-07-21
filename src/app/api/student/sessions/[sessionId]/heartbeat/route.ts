import { NextResponse } from "next/server";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { clearExpiredRateLimits, enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    assertSameOrigin(request);
    const student = await getStudentSession();
    if (!student?.studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { sessionId } = await params;
    await enforceRateLimit({
      scope: "student-heartbeat",
      limit: 180,
      windowSeconds: 60 * 60,
      identifier: `${student.studentId}:${sessionId}`
    });
    await clearExpiredRateLimits();
    await prisma.studentSession.updateMany({
      where: { id: sessionId, studentId: student.studentId },
      data: { lastSeenAt: new Date() }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
      );
    }
    return NextResponse.json({ error: "Could not update heartbeat" }, { status: 500 });
  }
}
