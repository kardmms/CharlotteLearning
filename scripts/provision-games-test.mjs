import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { PrismaClient } from "@prisma/client";

if (process.env.PROVISION_GAMES_TEST_ACCOUNTS !== "true") {
  console.log("Games test provisioning skipped.");
  process.exit(0);
}

const deadline = Date.parse(process.env.GAMES_FEATURE_EXPIRES_AT || "");
const password = process.env.GAMES_TEST_PASSWORD || "";
if (process.env.VERCEL_ENV !== "production" || process.env.DATABASE_ENVIRONMENT !== "production"
  || process.env.GAMES_FEATURE_ENABLED !== "true" || password.length < 16
  || !Number.isFinite(deadline) || deadline <= Date.now() || deadline - Date.now() > 86400000) {
  throw new Error("Games test provisioning requires an explicitly enabled, time-limited production test and a strong test password.");
}
const databaseHost = new URL(process.env.DATABASE_URL).hostname;
if (["localhost", "127.0.0.1", "::1"].includes(databaseHost)) {
  throw new Error("Production test provisioning cannot run against the local database.");
}

const teacherEmail = "games.teacher.20260827@example.com";
const studentDetails = [
  ["Abigail Walker", "games.abigail.20260827@example.com"],
  ["Aiden Brown", "games.aiden.20260827@example.com"]
];
const words = [
  ["observe", "To watch something carefully and notice details."],
  ["predict", "To say what you think will happen next."],
  ["compare", "To explain how two things are alike and different."],
  ["evidence", "Facts or details that support an idea."],
  ["infer", "To use clues and what you know to reach a conclusion."],
  ["summarize", "To retell the main ideas briefly."],
  ["sequence", "The order in which events happen."],
  ["cause", "The reason something happens."],
  ["effect", "A result of something that happened."],
  ["solution", "An answer to a problem."]
];
const passwordHash = await bcrypt.hash(password, 12);
const prisma = new PrismaClient();
try {
  const result = await prisma.$transaction(async (tx) => {
    let teacher = await tx.teacher.findUnique({ where: { email: teacherEmail } });
    let school = await tx.school.findUnique({ where: { slug: "games-test-20260827" } });
    if (teacher || school) {
      if (!teacher || !school || teacher.defaultSchoolId !== school.id
        || teacher.name !== "Games Test Teacher" || !(await bcrypt.compare(password, teacher.passwordHash))) {
        throw new Error("Refusing to overwrite an existing teacher or school.");
      }
    } else {
      teacher = await tx.teacher.create({ data: { email: teacherEmail, name: "Games Test Teacher", passwordHash, weeklySummaryEnabled: false } });
      school = await tx.school.create({ data: { slug: "games-test-20260827", name: "Games Test Workspace" } });
      await tx.schoolTeacher.create({ data: { schoolId: school.id, teacherId: teacher.id, role: "OWNER" } });
      await tx.teacher.update({ where: { id: teacher.id }, data: { defaultSchoolId: school.id } });
    }
    const classroom = await tx.classroom.upsert({
      where: { id: "games-test-20260827-class" }, update: {},
      create: { id: "games-test-20260827-class", name: "Games Test Class", gradeLevel: "3", identityMode: "STANDARD", teacherId: teacher.id, schoolId: school.id }
    });
    if (classroom.teacherId !== teacher.id || classroom.schoolId !== school.id) throw new Error("Test classroom ownership mismatch.");
    for (const [displayName, email] of studentDetails) {
      let account = await tx.studentAccount.findUnique({ where: { email } });
      if (account) {
        const enrollment = await tx.student.findFirst({ where: { accountId: account.id, classroomId: classroom.id, schoolId: school.id } });
        if (!enrollment || !(await bcrypt.compare(password, account.passwordHash))) throw new Error("Refusing to overwrite an existing student account.");
      } else {
        account = await tx.studentAccount.create({ data: { displayName, email, passwordHash } });
        await tx.student.create({ data: { displayName, email, accountId: account.id, schoolId: school.id, classroomId: classroom.id, active: true } });
      }
    }
    let room = await tx.gameRoom.findUnique({ where: { id: "games-test-20260827-room" } });
    if (room && (room.teacherId !== teacher.id || room.schoolId !== school.id)) throw new Error("Test room ownership mismatch.");
    if (!room) {
      let code;
      do { code = String(randomInt(100000, 1000000)); } while (await tx.gameRoom.findUnique({ where: { code } }));
      room = await tx.gameRoom.create({ data: {
        id: "games-test-20260827-room", schoolId: school.id, teacherId: teacher.id, classroomId: classroom.id, code,
        vocabTerms: { create: words.map(([word, definition], sortOrder) => ({ schoolId: school.id, word, definition, sortOrder })) }
      } });
    }
    return { teacherEmail, studentEmails: studentDetails.map(([, email]) => email), classroomId: classroom.id, roomId: room.id, code: room.code };
  }, { maxWait: 10000, timeout: 60000 });
  console.log("Games test accounts ready:", JSON.stringify(result));
} finally {
  await prisma.$disconnect();
}
