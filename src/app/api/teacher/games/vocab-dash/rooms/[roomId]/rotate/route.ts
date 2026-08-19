import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { auditEventData } from "@/lib/audit";
import { getTeacherContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertSameOrigin, isSameOriginError } from "@/lib/security";

async function uniqueCode() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    if (!(await prisma.gameRoom.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
  throw new Error("Could not rotate game code.");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    assertSameOrigin(request);
    const teacher = await getTeacherContext();
    if (!teacher) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { roomId } = await params;
    const room = await prisma.gameRoom.findFirst({
      where: { id: roomId, teacherId: teacher.id, schoolId: teacher.schoolId, status: "WAITING" },
      select: { id: true, code: true }
    });
    if (!room) return NextResponse.json({ ok: true });
    const code = await uniqueCode();
    await prisma.$transaction([
      prisma.gameParticipant.deleteMany({ where: { roomId: room.id, schoolId: teacher.schoolId } }),
      prisma.gameRoom.update({
        where: { id: room.id },
        data: { code, startedAt: null, endedAt: null, status: "WAITING" }
      }),
      prisma.auditEvent.create({
        data: auditEventData({
          schoolId: teacher.schoolId,
          actorType: "teacher",
          actorId: teacher.id,
          action: "game_room.code_rotated",
          targetType: "game_room",
          targetId: room.id,
          metadata: { previousCode: room.code, code }
        })
      })
    ]);
    return NextResponse.json({ ok: true, code });
  } catch (error) {
    if (isSameOriginError(error)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Could not close the previous lobby." }, { status: 500 });
  }
}
