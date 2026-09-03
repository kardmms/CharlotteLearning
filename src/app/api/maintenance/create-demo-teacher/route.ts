import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

const maintenanceToken = "064f0d1d4dab0e547c29b453a8278c1b15ab0ad0375e0c88e02feb91a323f71b";

export async function POST(request: Request) {
  const submittedToken = request.headers.get("x-maintenance-token") || "";
  if (submittedToken !== maintenanceToken) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const password = "Charlotte-" + crypto.randomBytes(6).toString("base64url") + "!9";
  const suffix = crypto.randomBytes(3).toString("hex");
  const email = `teacher-20260902-${suffix}@charlottelearning.ai`;
  const passwordHash = await hashPassword(password);

  const teacher = await prisma.$transaction(async (transaction) => {
    const created = await transaction.teacher.create({
      data: {
        email,
        name: "Demo Teacher",
        passwordHash,
        weeklySummaryEnabled: false
      }
    });
    const school = await transaction.school.create({
      data: {
        name: "Demo School Workspace",
        slug: `demo-${created.id.slice(0, 16)}`
      }
    });
    await transaction.schoolTeacher.create({
      data: {
        schoolId: school.id,
        teacherId: created.id,
        role: "OWNER"
      }
    });
    await transaction.teacher.update({
      where: { id: created.id },
      data: { defaultSchoolId: school.id }
    });
    const classroom = await transaction.classroom.create({
      data: {
        schoolId: school.id,
        teacherId: created.id,
        name: "Demo Literacy Class",
        gradeLevel: "3"
      }
    });
    return { id: created.id, email: created.email, classroomId: classroom.id };
  });

  return NextResponse.json({
    email,
    password,
    teacherId: teacher.id,
    classroomId: teacher.classroomId
  });
}
