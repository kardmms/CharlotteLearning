import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const teacherPassword = process.env.GRADE9_DEMO_TEACHER_PASSWORD;
const studentPassword = process.env.GRADE9_DEMO_STUDENT_PASSWORD;
if (!teacherPassword && !studentPassword) {
  console.log("Grade 9 demo provisioning skipped.");
  process.exit(0);
}

if (
  process.env.VERCEL_ENV !== "production" ||
  process.env.DATABASE_ENVIRONMENT !== "production" ||
  !teacherPassword || teacherPassword.length < 16 ||
  !studentPassword || studentPassword.length < 16
) {
  throw new Error("Grade 9 demo provisioning requires production and two strong passwords.");
}

const teacherEmail = "grade9.teacher.20260928@example.test";
const studentEmail = "grade9.student.20260928@example.test";
const classroomId = "grade9-demo-20260928-class";
const prisma = new PrismaClient();

try {
  const teacherHash = await bcrypt.hash(teacherPassword, 12);
  const studentHash = await bcrypt.hash(studentPassword, 12);
  const result = await prisma.$transaction(async (tx) => {
    const existingTeacher = await tx.teacher.findUnique({ where: { email: teacherEmail } });
    const existingStudent = await tx.studentAccount.findUnique({ where: { email: studentEmail } });
    const existingSchool = await tx.school.findUnique({ where: { slug: "charlotte-grade9-demo-20260928" } });
    const existingClassroom = await tx.classroom.findUnique({ where: { id: classroomId } });
    if (existingTeacher || existingStudent || existingSchool || existingClassroom) {
      throw new Error("Grade 9 demo records already exist; refusing to overwrite them.");
    }

    const teacher = await tx.teacher.create({
      data: {
        name: "Charlotte Grade 9 Demo",
        email: teacherEmail,
        passwordHash: teacherHash,
        weeklySummaryEnabled: false
      }
    });
    const school = await tx.school.create({
      data: { name: "Charlotte Demo School", slug: "charlotte-grade9-demo-20260928" }
    });
    await tx.schoolTeacher.create({
      data: { schoolId: school.id, teacherId: teacher.id, role: "OWNER" }
    });
    await tx.teacher.update({
      where: { id: teacher.id }, data: { defaultSchoolId: school.id }
    });
    await tx.classroom.create({
      data: {
        id: classroomId,
        name: "English 9 · Demo Class",
        gradeLevel: "9",
        identityMode: "STANDARD",
        schoolId: school.id,
        teacherId: teacher.id
      }
    });
    const student = await tx.studentAccount.create({
      data: {
        displayName: "Alex Rivera",
        email: studentEmail,
        passwordHash: studentHash
      }
    });
    await tx.student.create({
      data: {
        displayName: "Alex Rivera",
        email: studentEmail,
        accountId: student.id,
        schoolId: school.id,
        classroomId,
        active: true
      }
    });
    return { teacherEmail, studentEmail, classroomId };
  }, { maxWait: 10000, timeout: 60000 });
  console.log("Grade 9 demo accounts ready:", JSON.stringify(result));
} finally {
  await prisma.$disconnect();
}
