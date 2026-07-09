import { NextResponse } from "next/server";
import { getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertSameOrigin } from "@/lib/security";

export const runtime = "nodejs";

const allowed = [
  "openedBook",
  "foundChapter",
  "heardVocabulary",
  "answeredPrompt",
  "madePrediction",
  "understoodStory"
] as const;

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
      where: { id: sessionId, studentId: student.studentId }
    });
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const body = (await request.json()) as Record<string, unknown>;
    const data: Record<string, boolean | Date> = { lastSeenAt: new Date() };
    for (const key of allowed) {
      if (typeof body[key] === "boolean") data[key] = body[key] as boolean;
    }

    await prisma.studentSession.update({
      where: { id: sessionId },
      data
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not update progress" }, { status: 500 });
  }
}
