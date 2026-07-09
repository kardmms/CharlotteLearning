import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";

function loadEnvFile(fileName) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to reset presentation data.");
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const teacherEmail = requiredEnv("FRESH_TEACHER_EMAIL").toLowerCase();
const teacherPassword = requiredEnv("FRESH_TEACHER_PASSWORD");
const teacherName = process.env.FRESH_TEACHER_NAME?.trim() || "Demo Teacher";
const className = process.env.FRESH_CLASS_NAME?.trim() || "3rd Grade Demo Class";
const gradeLevel = process.env.FRESH_GRADE_LEVEL?.trim() || "3";
const studentName = process.env.FRESH_STUDENT_NAME?.trim() || "Demo Student";
const studentEmail = requiredEnv("FRESH_STUDENT_EMAIL").toLowerCase();
const studentPassword = requiredEnv("FRESH_STUDENT_PASSWORD");

await prisma.$transaction(async (tx) => {
  await tx.studentAnswer.deleteMany();
  await tx.studentSession.deleteMany();
  await tx.question.deleteMany();
  await tx.material.deleteMany();
  await tx.atHomeResource.deleteMany();
  await tx.student.deleteMany();
  await tx.classroom.deleteMany();
  await tx.teacher.deleteMany();
  await tx.studentAccount.deleteMany();
  await tx.contactLead.deleteMany();

  const teacher = await tx.teacher.create({
    data: {
      name: teacherName,
      email: teacherEmail,
      passwordHash: await bcrypt.hash(teacherPassword, 12)
    }
  });

  const classroom = await tx.classroom.create({
    data: {
      name: className,
      gradeLevel,
      teacherId: teacher.id
    }
  });

  const account = await tx.studentAccount.create({
    data: {
      displayName: studentName,
      email: studentEmail,
      passwordHash: await bcrypt.hash(studentPassword, 12)
    }
  });

  await tx.student.create({
    data: {
      classroomId: classroom.id,
      accountId: account.id,
      displayName: studentName,
      email: studentEmail
    }
  });
});

console.log(JSON.stringify({
  ok: true,
  teacher: { name: teacherName, email: teacherEmail, password: teacherPassword },
  class: { name: className, gradeLevel },
  student: { name: studentName, email: studentEmail, password: studentPassword }
}, null, 2));

await prisma.$disconnect();
