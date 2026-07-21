import { NextResponse } from "next/server";
import { getStudentSession, setStudentCompletionLock } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { finalizeStudentSession } from "@/lib/finalize-session";
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
      scope: "student-focus",
      limit: 30,
      windowSeconds: 60 * 60,
      identifier: `${student.studentId}:${sessionId}`
    });
    await clearExpiredRateLimits();
    const session = await prisma.studentSession.findFirst({
      where: { id: sessionId, studentId: student.studentId },
      include: { material: true }
    });
    if (!session || session.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "Session is not active" }, { status: 409 });
    }

    const violationCount = session.focusViolationCount + 1;
    const ended = violationCount >= 2;
    if (ended) {
      await finalizeStudentSession({
        sessionId: session.id,
        outcome: "focus-loss",
        focusViolationCount: violationCount
      });
    } else {
      await prisma.studentSession.update({
        where: { id: session.id },
        data: {
          focusViolationCount: violationCount,
          flaggedAt: new Date(),
          lastSeenAt: new Date()
        }
      });
    }

    if (ended && session.material.activityKind === "IN_CLASS") {
      await setStudentCompletionLock(session.materialId);
    }

    return NextResponse.json({ violationCount, ended });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
      );
    }
    return NextResponse.json({ error: "Could not record focus change" }, { status: 500 });
  }
}
