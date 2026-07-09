import { NextResponse } from "next/server";
import { getStudentSession, setStudentCompletionLock } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { finalizeStudentSession } from "@/lib/finalize-session";
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
    const session = await prisma.studentSession.findFirst({
      where: { id: sessionId, studentId: student.studentId },
      include: { material: true }
    });
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const body = await request.json().catch(() => ({})) as { timeExpired?: boolean };
    const updated = await finalizeStudentSession({
      sessionId,
      outcome: body.timeExpired ? "timed-out" : "submitted"
    });

    if (session.material.activityKind === "IN_CLASS") {
      await setStudentCompletionLock(session.materialId);
    }

    return NextResponse.json({ ok: true, pointsEarned: updated.pointsEarned });
  } catch {
    return NextResponse.json({ error: "Could not finish session" }, { status: 500 });
  }
}
