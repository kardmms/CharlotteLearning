import { NextResponse } from "next/server";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
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
    await prisma.studentSession.updateMany({
      where: { id: sessionId, studentId: student.studentId },
      data: { lastSeenAt: new Date() }
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not update heartbeat" }, { status: 500 });
  }
}
