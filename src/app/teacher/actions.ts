"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ActivityKind, IdentityMode, MaterialStatus, QuestionType } from "@prisma/client";
import { readSheet } from "read-excel-file/node";
import { prisma } from "@/lib/db";
import {
  clearTeacherSession,
  hashPassword,
  requireTeacher,
  setTeacherSession,
  verifyPassword
} from "@/lib/auth";
import { normalizeStudentEmail } from "@/lib/codes";
import { extractStudentRosterWithAI, generateQuestionsFromText } from "@/lib/ai";
import { BotProtectionError, enforceTurnstile } from "@/lib/bot-protection";
import { extractTextFromUpload } from "@/lib/extract-text";
import { normalizeGrade } from "@/lib/grade";
import { clearExpiredRateLimits, enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import {
  cleanPrivacyKey,
  createClassPrivacyRecoveryKey,
  createPrivacyKeySalt,
  decryptIdentityValue,
  deriveClassPrivacyKey,
  encryptIdentityValue,
  isUsablePrivacyKey,
  privacyKeyVerifierFromDerivedKey,
  studentEmailLookupHash,
  verifyClassPrivacyKey
} from "@/lib/school-privacy";

function formText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function errorRedirect(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

async function enforceOrRedirect(path: string, callback: () => Promise<void>) {
  try {
    await callback();
    await clearExpiredRateLimits();
  } catch (error) {
    if (error instanceof RateLimitError || error instanceof BotProtectionError) {
      errorRedirect(path, error.message);
    }
    throw error;
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase().slice(0, 254);
}

function normalizePhone(value: string) {
  return value
    .replace(/[^\d+().\-\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

function boundedText(formData: FormData, key: string, maxLength: number) {
  return formText(formData, key).slice(0, maxLength);
}

function teacherReturnPath(formData: FormData, fallback: string) {
  const returnPath = formText(formData, "returnPath");
  return returnPath.startsWith("/teacher") ? returnPath : fallback;
}

async function setClassRecoveryKeyFlash(classroomId: string, className: string, recoveryKey: string) {
  const cookieStore = await cookies();
  cookieStore.set(
    "charlotte_class_recovery_key_flash",
    Buffer.from(JSON.stringify({ classroomId, className, recoveryKey })).toString("base64url"),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/teacher",
      maxAge: 60 * 30
    }
  );
}

function optionalDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function questionPointValue(sortOrder: number, questionCount: number) {
  const base = Math.floor(100 / questionCount);
  const remainder = 100 % questionCount;
  return base + (sortOrder <= remainder ? 1 : 0);
}

export async function createFirstTeacher(formData: FormData) {
  await enforceOrRedirect("/teacher/setup", async () => {
    await enforceRateLimit({ scope: "teacher-setup-ip", limit: 10, windowSeconds: 60 * 60 });
    await enforceTurnstile(formData, "teacher_setup");
  });
  const existing = await prisma.teacher.count();
  if (existing > 0) redirect("/teacher/login");

  const name = boundedText(formData, "name", 120);
  const email = normalizeEmail(formText(formData, "email"));
  const password = boundedText(formData, "password", 1024);

  if (name.length < 2) errorRedirect("/teacher/setup", "Please enter the teacher name.");
  if (!email.includes("@")) errorRedirect("/teacher/setup", "Please enter a valid email.");
  if (password.length < 10) {
    errorRedirect("/teacher/setup", "Use a password with at least 10 characters.");
  }

  const teacher = await prisma.teacher.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password)
    }
  });

  await setTeacherSession(teacher);
  const classroomCount = await prisma.classroom.count({
    where: { teacherId: teacher.id, archivedAt: null }
  });
  redirect(classroomCount > 0 ? "/teacher/classes" : "/teacher");
}

export async function createTeacherAccount(formData: FormData) {
  const signupPath = "/teacher/signup";
  const name = boundedText(formData, "name", 120);
  const email = normalizeEmail(formText(formData, "email"));
  const password = boundedText(formData, "password", 1024);

  await enforceOrRedirect(signupPath, async () => {
    await enforceRateLimit({ scope: "teacher-signup-ip", limit: 20, windowSeconds: 60 * 60 });
    await enforceRateLimit({ scope: "teacher-signup-email", limit: 5, windowSeconds: 24 * 60 * 60, identifier: email });
    await enforceTurnstile(formData, "teacher_signup");
  });

  if (name.length < 2) errorRedirect(signupPath, "Please enter the teacher name.");
  if (!email.includes("@")) errorRedirect(signupPath, "Please enter a valid email.");
  if (password.length < 10) {
    errorRedirect(signupPath, "Use a password with at least 10 characters.");
  }

  const existing = await prisma.teacher.findUnique({ where: { email } });
  if (existing) {
    errorRedirect("/teacher/login", "An account already exists for this email. Sign in instead.");
  }

  const teacher = await prisma.teacher.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password)
    }
  });

  await setTeacherSession(teacher);
  redirect("/teacher");
}

export async function loginTeacher(formData: FormData) {
  const email = normalizeEmail(formText(formData, "email"));
  const password = boundedText(formData, "password", 1024);
  await enforceOrRedirect("/teacher/login", async () => {
    await enforceRateLimit({ scope: "teacher-login-ip", limit: 100, windowSeconds: 60 * 60 });
    await enforceRateLimit({ scope: "teacher-login-email", limit: 12, windowSeconds: 15 * 60, identifier: email });
    await enforceTurnstile(formData, "teacher_login");
  });

  const teacher = await prisma.teacher.findUnique({ where: { email } });
  if (!teacher) errorRedirect("/teacher/login", "Email or password was not recognized.");

  const ok = await verifyPassword(password, teacher.passwordHash);
  if (!ok) errorRedirect("/teacher/login", "Email or password was not recognized.");

  await setTeacherSession(teacher);
  const classroomCount = await prisma.classroom.count({
    where: { teacherId: teacher.id, archivedAt: null }
  });
  redirect(classroomCount > 0 ? "/teacher/classes" : "/teacher");
}

export async function logoutTeacher() {
  await clearTeacherSession();
  redirect("/");
}

export async function createClassroom(formData: FormData) {
  const teacher = await requireTeacher();
  const errorPath = teacherReturnPath(formData, "/teacher");
  await enforceOrRedirect(errorPath, async () => {
    await enforceRateLimit({ scope: "teacher-create-class", limit: 30, windowSeconds: 60 * 60, identifier: teacher.id });
  });
  const name = boundedText(formData, "name", 120);
  const gradeLevel = normalizeGrade(formText(formData, "gradeLevel"));

  if (name.length < 2) errorRedirect(errorPath, "Please name the class.");
  if (!gradeLevel) errorRedirect(errorPath, "Please enter a grade level.");

  const recoveryKey = createClassPrivacyRecoveryKey();
  const privacySalt = createPrivacyKeySalt();
  const derivedPrivacyKey = deriveClassPrivacyKey(recoveryKey, privacySalt);

  const classroom = await prisma.classroom.create({
    data: {
      name,
      gradeLevel,
      teacherId: teacher.id,
      identityMode: IdentityMode.SCHOOL_KEY,
      privacyKeySalt: privacySalt,
      privacyKeyVerifier: privacyKeyVerifierFromDerivedKey(derivedPrivacyKey),
      privacyKeyHint: null
    }
  });

  await setClassRecoveryKeyFlash(classroom.id, classroom.name, recoveryKey);
  redirect(`/teacher/classes/${classroom.id}/roster`);
}

export async function deleteClassroom(formData: FormData) {
  const teacher = await requireTeacher();
  const classroomId = formText(formData, "classroomId");
  await enforceOrRedirect("/teacher/classes", async () => {
    await enforceRateLimit({ scope: "teacher-delete-class", limit: 10, windowSeconds: 60 * 60, identifier: teacher.id });
  });

  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, teacherId: teacher.id }
  });
  if (!classroom) errorRedirect("/teacher", "Class not found.");

  await prisma.classroom.delete({ where: { id: classroom.id } });
  redirect("/teacher/classes");
}

export async function archiveClassroom(formData: FormData) {
  const teacher = await requireTeacher();
  const classroomId = formText(formData, "classroomId");
  await enforceOrRedirect("/teacher/classes", async () => {
    await enforceRateLimit({ scope: "teacher-archive-class", limit: 30, windowSeconds: 60 * 60, identifier: teacher.id });
  });

  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, teacherId: teacher.id }
  });
  if (!classroom) errorRedirect("/teacher/classes", "Class not found.");

  await prisma.classroom.update({
    where: { id: classroom.id },
    data: { archivedAt: new Date() }
  });
  redirect("/teacher/classes");
}

export async function unarchiveClassroom(formData: FormData) {
  const teacher = await requireTeacher();
  const classroomId = formText(formData, "classroomId");
  await enforceOrRedirect("/teacher/archive", async () => {
    await enforceRateLimit({ scope: "teacher-restore-class", limit: 30, windowSeconds: 60 * 60, identifier: teacher.id });
  });

  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, teacherId: teacher.id }
  });
  if (!classroom) errorRedirect("/teacher/archive", "Class not found.");

  await prisma.classroom.update({
    where: { id: classroom.id },
    data: { archivedAt: null }
  });
  redirect("/teacher/archive");
}

function isValidStudentEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function cleanStudentRows(rows: Array<{ displayName: string; email: string }>) {
  return rows
    .map((row) => ({
      displayName: row.displayName.trim().slice(0, 120),
      email: normalizeStudentEmail(row.email).slice(0, 254)
    }))
    .filter((row) => row.displayName || row.email);
}

async function createStudentsFromRows(
  teacherId: string,
  classroomId: string,
  rows: Array<{ displayName: string; email: string }>,
  errorPath: string,
  rawPrivacyKey = ""
) {
  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, teacherId }
  });
  if (!classroom) errorRedirect("/teacher", "Class not found.");

  const cleaned = cleanStudentRows(rows);
  if (cleaned.length === 0) errorRedirect(errorPath, "Add at least one student.");

  for (const row of cleaned) {
    if (row.displayName.length < 2 || !isValidStudentEmail(row.email)) {
      errorRedirect(errorPath, "Each student needs a name and a valid email address.");
    }
  }

  const privacyKey = cleanPrivacyKey(rawPrivacyKey);
  const usesPrivacyKey = classroom.identityMode === IdentityMode.SCHOOL_KEY || Boolean(privacyKey);

  if (usesPrivacyKey) {
    if (!isUsablePrivacyKey(privacyKey)) {
      errorRedirect(errorPath, "Enter this classroom recovery key before adding students.");
    }

    const existingStudentCount = await prisma.student.count({ where: { classroomId } });
    const salt = classroom.privacyKeySalt || createPrivacyKeySalt();
    const derivedKey = deriveClassPrivacyKey(privacyKey, salt);
    const verifier = privacyKeyVerifierFromDerivedKey(derivedKey);

    if (classroom.privacyKeyVerifier && classroom.privacyKeyVerifier !== verifier) {
      errorRedirect(errorPath, "That recovery key does not match this class.");
    }

    const rowsWithHashes = cleaned.map((row) => ({
      ...row,
      emailKeyHash: studentEmailLookupHash(row.email)
    }));
    const seenHashes = new Set<string>();
    for (const row of rowsWithHashes) {
      if (seenHashes.has(row.emailKeyHash)) {
        errorRedirect(errorPath, "Each student email can only appear once in the import.");
      }
      seenHashes.add(row.emailKeyHash);
    }

    const existingAccounts = await prisma.studentAccount.findMany({
      where: { emailKeyHash: { in: rowsWithHashes.map((row) => row.emailKeyHash) } },
      select: { id: true, emailKeyHash: true }
    });
    const accountByEmailHash = new Map(
      existingAccounts
        .filter((account) => account.emailKeyHash)
        .map((account) => [account.emailKeyHash as string, account.id])
    );
    const data = rowsWithHashes.map((row, index) => ({
      classroomId,
      accountId: accountByEmailHash.get(row.emailKeyHash) || null,
      displayName: `Student ${existingStudentCount + index + 1}`,
      email: null,
      displayNameEncrypted: encryptIdentityValue(row.displayName, derivedKey),
      emailEncrypted: encryptIdentityValue(row.email, derivedKey),
      emailKeyHash: row.emailKeyHash
    }));

    try {
      await prisma.$transaction(async (transaction) => {
        if (classroom.identityMode !== IdentityMode.SCHOOL_KEY || !classroom.privacyKeySalt || !classroom.privacyKeyVerifier) {
          await transaction.classroom.update({
            where: { id: classroomId },
            data: {
              identityMode: IdentityMode.SCHOOL_KEY,
              privacyKeySalt: salt,
              privacyKeyVerifier: verifier
            }
          });
        }
        await transaction.student.createMany({ data });
      });
    } catch {
      errorRedirect(errorPath, "Student invitations must be unique inside the class.");
    }
    return;
  }

  const seen = new Set<string>();
  const existingAccounts = await prisma.studentAccount.findMany({
    where: { email: { in: cleaned.map((row) => row.email) } },
    select: { id: true, email: true }
  });
  const accountByEmail = new Map(existingAccounts.map((account) => [account.email, account.id]));
  const data = cleaned.map((row) => {
    if (seen.has(row.email)) {
      errorRedirect(errorPath, "Each student email can only appear once in the import.");
    }
    seen.add(row.email);
    return {
      classroomId,
      accountId: accountByEmail.get(row.email) || null,
      displayName: row.displayName,
      email: row.email
    };
  });

  try {
    await prisma.student.createMany({ data });
  } catch {
    errorRedirect(errorPath, "Student names and emails must be unique inside the class.");
  }
}

export async function addStudents(formData: FormData) {
  const teacher = await requireTeacher();
  const classroomId = formText(formData, "classroomId");
  const path = `/teacher/classes/${classroomId}/roster`;
  await enforceOrRedirect(path, async () => {
    await enforceRateLimit({ scope: "teacher-add-students", limit: 40, windowSeconds: 60 * 60, identifier: teacher.id });
  });
  const names = formData.getAll("studentName").map((value) => String(value));
  const emails = formData.getAll("studentEmail").map((value) => String(value));
  const rows = names.map((displayName, index) => ({
      displayName: displayName.trim().slice(0, 120),
      email: emails[index] || ""
  }));

  await createStudentsFromRows(teacher.id, classroomId, rows, path, formText(formData, "privacyKey"));
  redirect(`${path}?saved=1`);
}

export type RosterImportState = {
  rows: Array<{ displayName: string; email: string }>;
  fileName: string;
  error?: string;
};

export type RosterRevealState = {
  rows: Array<{ id: string; displayName: string; email: string }>;
  keyAccepted?: boolean;
  error?: string;
};

export async function revealRosterIdentities(
  _previousState: RosterRevealState,
  formData: FormData
): Promise<RosterRevealState> {
  const teacher = await requireTeacher();
  const classroomId = formText(formData, "classroomId");
  const privacyKey = cleanPrivacyKey(formText(formData, "privacyKey"));
  try {
    await enforceRateLimit({
      scope: "teacher-reveal-roster",
      limit: 30,
      windowSeconds: 60 * 60,
      identifier: `${teacher.id}:${classroomId}`
    });
    await clearExpiredRateLimits();
  } catch (error) {
    if (error instanceof RateLimitError) {
      return { rows: [], error: error.message };
    }
    throw error;
  }

  if (!isUsablePrivacyKey(privacyKey)) {
    return { rows: [], error: "Enter the full classroom recovery key." };
  }

  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, teacherId: teacher.id },
    select: {
      identityMode: true,
      privacyKeySalt: true,
      privacyKeyVerifier: true,
      students: {
        where: { active: true },
        orderBy: { displayName: "asc" },
        select: {
          id: true,
          displayName: true,
          email: true,
          displayNameEncrypted: true,
          emailEncrypted: true
        }
      }
    }
  });
  if (!classroom) return { rows: [], error: "Class not found." };
  if (classroom.identityMode !== IdentityMode.SCHOOL_KEY) {
    return { rows: [], error: "This class does not use a classroom recovery key." };
  }
  if (!verifyClassPrivacyKey(privacyKey, classroom.privacyKeySalt, classroom.privacyKeyVerifier)) {
    return { rows: [], error: "That recovery key does not match this class." };
  }

  const derivedKey = deriveClassPrivacyKey(privacyKey, classroom.privacyKeySalt as string);
  try {
    return {
      keyAccepted: true,
      rows: classroom.students.map((student) => ({
        id: student.id,
        displayName: student.displayNameEncrypted
          ? decryptIdentityValue(student.displayNameEncrypted, derivedKey)
          : student.displayName,
        email: student.emailEncrypted
          ? decryptIdentityValue(student.emailEncrypted, derivedKey)
          : student.email || ""
      }))
    };
  } catch {
    return { rows: [], error: "Charlotte could not decrypt this roster with that key." };
  }
}

function parseDelimitedRows(text: string, delimiter: "," | "\t") {
  const rows: unknown[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    pushCell();
    if (row.some((value) => value.trim())) {
      rows.push(row.slice(0, 20));
    }
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === "\"") {
        if (text[index + 1] === "\"") {
          cell += "\"";
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else if (char === "\"") {
      inQuotes = true;
    } else if (char === delimiter) {
      pushCell();
    } else if (char === "\n") {
      pushRow();
    } else if (char === "\r") {
      if (text[index + 1] === "\n") index += 1;
      pushRow();
    } else {
      cell += char;
    }
  }

  if (cell || row.length > 0) pushRow();
  return rows.slice(0, 500);
}

async function readRosterRows(file: File) {
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith(".csv") || file.type === "text/csv") {
    return parseDelimitedRows(await file.text(), ",");
  }
  if (fileName.endsWith(".tsv") || file.type === "text/tab-separated-values") {
    return parseDelimitedRows(await file.text(), "\t");
  }
  if (
    fileName.endsWith(".xlsx") ||
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return readSheet(Buffer.from(await file.arrayBuffer()));
  }
  throw new Error("Unsupported roster file type.");
}

export async function prepareStudentImport(
  _previousState: RosterImportState,
  formData: FormData
): Promise<RosterImportState> {
  const teacher = await requireTeacher();
  const classroomId = formText(formData, "classroomId");
  try {
    await enforceRateLimit({ scope: "teacher-import-roster", limit: 20, windowSeconds: 60 * 60, identifier: teacher.id });
    await clearExpiredRateLimits();
  } catch (error) {
    if (error instanceof RateLimitError) {
      return { rows: [], fileName: "", error: error.message };
    }
    throw error;
  }
  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, teacherId: teacher.id }
  });
  if (!classroom) return { rows: [], fileName: "", error: "Class not found." };

  const file = formData.get("studentFile");
  if (!(file instanceof File) || file.size === 0) {
    return { rows: [], fileName: "", error: "Upload a CSV, TSV, or XLSX spreadsheet." };
  }
  if (file.size > 4 * 1024 * 1024) {
    return { rows: [], fileName: file.name, error: "Upload a student spreadsheet no larger than 4 MB." };
  }

  try {
    const values = await readRosterRows(file);
    if (values.length === 0) {
      return { rows: [], fileName: file.name, error: "The spreadsheet appears to be empty." };
    }
    const rows = await extractStudentRosterWithAI(values);
    if (rows.length === 0) {
      return { rows: [], fileName: file.name, error: "Charlotte could not find any student rows." };
    }
    return { rows, fileName: file.name };
  } catch {
    return { rows: [], fileName: file.name, error: "Charlotte could not read that spreadsheet." };
  }
}

export async function createMaterial(formData: FormData) {
  const teacher = await requireTeacher();
  const classroomId = formText(formData, "classroomId");
  const title = boundedText(formData, "title", 180);
  const creationMode = formText(formData, "creationMode") === "manual" ? "manual" : "ai";
  const dueAt = optionalDate(formText(formData, "dueAt"));
  const readingScope = formText(formData, "readingScope").slice(0, 160) || null;
  const estimatedMinutes = Math.min(
    30,
    Math.max(10, Number(formData.get("estimatedMinutes") || 15))
  );
  const path = `/teacher/classes/${classroomId}/materials/new`;
  await enforceOrRedirect(path, async () => {
    await enforceRateLimit({ scope: "teacher-create-material", limit: 30, windowSeconds: 60 * 60, identifier: teacher.id });
    if (creationMode === "ai") {
      await enforceRateLimit({ scope: "teacher-ai-material", limit: 12, windowSeconds: 60 * 60, identifier: teacher.id });
    }
  });

  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, teacherId: teacher.id }
  });
  if (!classroom) errorRedirect("/teacher", "Class not found.");
  if (title.length < 2) errorRedirect(path, "Please enter a title for the material.");

  if (creationMode === "manual") {
    const material = await prisma.material.create({
      data: {
        teacherId: teacher.id,
        classroomId,
        title,
        gradeLevel: classroom.gradeLevel,
        estimatedMinutes,
        activityKind: ActivityKind.IN_CLASS,
        dueAt,
        availableAt: new Date(),
        atHomeScope: readingScope,
        generationNotes: "Created manually by the teacher.",
        questions: {
          create: Array.from({ length: 5 }, (_, index) => ({
            type: QuestionType.SHORT_RESPONSE,
            prompt: `Enter question ${index + 1}`,
            difficulty: 3,
            sortOrder: index + 1
          }))
        }
      }
    });
    redirect(`/teacher/classes/${classroomId}/materials/${material.id}/review`);
  }

  const file = formData.get("sourceFile");
  if (!(file instanceof File) || file.size === 0) {
    errorRedirect(path, "Please upload a PDF, DOCX, or TXT lesson plan.");
  }

  let materialId = "";
  try {
    const extracted = await extractTextFromUpload(file);
    const generated = await generateQuestionsFromText({
      title,
      gradeLevel: classroom.gradeLevel,
      estimatedMinutes,
      text: extracted.text,
      activityLabel: "In-class activity",
      activityFocus: ""
    });

    const material = await prisma.material.create({
      data: {
        teacherId: teacher.id,
        classroomId,
        title,
        gradeLevel: classroom.gradeLevel,
        estimatedMinutes,
        activityKind: ActivityKind.IN_CLASS,
        dueAt,
        availableAt: new Date(),
        sourceName: extracted.sourceName,
        sourceHash: extracted.sourceHash,
        sourcePreview: extracted.sourcePreview,
        sourceText: extracted.text,
        atHomeScope: readingScope,
        generationNotes: generated.notes,
        questions: {
          create: generated.questions.map((question, questionIndex) => ({
            type: question.type,
            prompt: question.prompt,
            choicesJson: question.choices?.length ? JSON.stringify(question.choices) : null,
            correctAnswer: question.correctAnswer || null,
            rubric: question.rubric || null,
            skillTag: question.skillTag || null,
            standardCode: question.standardCode || null,
            contextExcerpt: question.contextExcerpt || null,
            sourcePage: question.sourcePage || null,
            difficulty: question.difficulty,
            sortOrder: questionIndex + 1
          }))
        }
      }
    });
    materialId = material.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Material generation failed.";
    errorRedirect(path, message);
  }

  redirect(`/teacher/classes/${classroomId}/materials/${materialId}/review`);
}

export async function saveMaterialDraft(formData: FormData) {
  const teacher = await requireTeacher();
  const classroomId = formText(formData, "classroomId");
  const materialId = formText(formData, "materialId");
  const path = `/teacher/classes/${classroomId}/materials/${materialId}/review`;
  const returnTab = formText(formData, "returnTab");
  await enforceOrRedirect(path, async () => {
    await enforceRateLimit({ scope: "teacher-save-material", limit: 120, windowSeconds: 60 * 60, identifier: teacher.id });
  });

  const material = await prisma.material.findFirst({
    where: { id: materialId, classroomId, teacherId: teacher.id },
    include: { questions: true }
  });
  if (!material) errorRedirect("/teacher", "Material not found.");

  await prisma.material.update({
    where: { id: materialId },
    data: {
      title: formData.has("title") ? boundedText(formData, "title", 180) || material.title : material.title,
      gradeLevel: formData.has("gradeLevel")
        ? normalizeGrade(formText(formData, "gradeLevel") || material.gradeLevel)
        : material.gradeLevel,
      estimatedMinutes: formData.has("estimatedMinutes")
        ? Math.min(30, Math.max(10, Number(formData.get("estimatedMinutes") || 15)))
        : material.estimatedMinutes,
      activityKind: formData.has("activityKind")
        ? formText(formData, "activityKind") === ActivityKind.AT_HOME
          ? ActivityKind.AT_HOME
          : ActivityKind.IN_CLASS
        : material.activityKind,
      dueAt: formData.has("dueAt") ? optionalDate(formText(formData, "dueAt")) : material.dueAt,
      availableAt: formData.has("availableAt")
        ? optionalDate(formText(formData, "availableAt"))
        : material.availableAt,
      atHomeScope: formData.has("readingScope")
        ? formText(formData, "readingScope").slice(0, 160) || null
        : material.atHomeScope
    }
  });

  await Promise.all(
    material.questions.map((question) => {
      if (!formData.has(`prompt-${question.id}`)) return Promise.resolve(question);
      const type = formText(formData, `type-${question.id}`) as QuestionType;
      const format = formText(formData, `format-${question.id}`) || "MULTIPLE_CHOICE";
      const repeatedChoices = formData
        .getAll(`choice-${question.id}`)
        .map((choice) => String(choice).trim().slice(0, 240))
        .filter(Boolean);
      const textareaChoices = formText(formData, `choices-${question.id}`)
        .split(/\r?\n/)
        .map((choice) => choice.trim().slice(0, 240))
        .filter(Boolean);
      const choices = repeatedChoices.length ? repeatedChoices : textareaChoices;
      const useChoices = format === "MULTIPLE_CHOICE" || format === "CHECKBOXES";

      return prisma.question.update({
        where: { id: question.id },
        data: {
          type: Object.values(QuestionType).includes(type) ? type : question.type,
          prompt: formText(formData, `prompt-${question.id}`).slice(0, 500),
          choicesJson: useChoices && choices.length ? JSON.stringify(choices) : null,
          correctAnswer: useChoices ? formText(formData, `correct-${question.id}`).slice(0, 240) || null : null,
          rubric: formText(formData, `rubric-${question.id}`).slice(0, 900) || null,
          skillTag: formText(formData, `skill-${question.id}`).slice(0, 80) || null,
          standardCode: formText(formData, `standard-${question.id}`).slice(0, 80) || null,
          contextExcerpt: formText(formData, `context-${question.id}`).slice(0, 900) || null,
          sourcePage: formText(formData, `sourcePage-${question.id}`).slice(0, 80) || null,
          timeLimitSeconds: Math.max(0, Number(formData.get(`timeLimit-${question.id}`) || 0)) || null,
          randomizeChoices: formData.get(`randomize-${question.id}`) === "on",
          difficulty: Math.min(5, Math.max(1, Number(formData.get(`difficulty-${question.id}`) || 3)))
        }
      });
    })
  );

  redirect(`${path}?${returnTab ? `tab=${encodeURIComponent(returnTab)}&` : ""}saved=1`);
}

export async function deleteMaterial(formData: FormData) {
  const teacher = await requireTeacher();
  const classroomId = formText(formData, "classroomId");
  const materialId = formText(formData, "materialId");
  await enforceOrRedirect(`/teacher/classes/${classroomId}/materials`, async () => {
    await enforceRateLimit({ scope: "teacher-delete-material", limit: 30, windowSeconds: 60 * 60, identifier: teacher.id });
  });
  const material = await prisma.material.findFirst({
    where: { id: materialId, classroomId, teacherId: teacher.id }
  });
  if (!material) errorRedirect(`/teacher/classes/${classroomId}/materials`, "Assignment not found.");
  await prisma.material.delete({ where: { id: materialId } });
  redirect(`/teacher/classes/${classroomId}/materials?deleted=1`);
}

export async function uploadAtHomeResource(formData: FormData) {
  const teacher = await requireTeacher();
  const classroomId = formText(formData, "classroomId");
  const path = `/teacher/classes/${classroomId}/home-learning`;
  await enforceOrRedirect(path, async () => {
    await enforceRateLimit({ scope: "teacher-upload-home-resource", limit: 20, windowSeconds: 60 * 60, identifier: teacher.id });
  });
  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, teacherId: teacher.id }
  });
  if (!classroom) errorRedirect("/teacher/classes", "Class not found.");

  const file = formData.get("sourceFile");
  if (!(file instanceof File) || file.size === 0) {
    errorRedirect(path, "Drop in a PDF, DOCX, or TXT resource.");
  }

  try {
    const extracted = await extractTextFromUpload(file);
    const customTitle = boundedText(formData, "title", 180);
    const defaultTitle = extracted.sourceName.replace(/\.[^.]+$/, "");
    await prisma.atHomeResource.create({
      data: {
        teacherId: teacher.id,
        classroomId,
        title: customTitle || defaultTitle,
        sourceName: extracted.sourceName,
        sourceHash: extracted.sourceHash,
        sourcePreview: extracted.sourcePreview,
        sourceText: extracted.text,
        readingScope: formText(formData, "readingScope").slice(0, 160) || null
      }
    });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("Unique constraint")
      ? "That document is already in the at-home resource library."
      : error instanceof Error
        ? error.message
        : "Charlotte could not read that document.";
    errorRedirect(path, message);
  }

  redirect(`${path}?saved=1`);
}

export async function deleteAtHomeResource(formData: FormData) {
  const teacher = await requireTeacher();
  const classroomId = formText(formData, "classroomId");
  const resourceId = formText(formData, "resourceId");
  const path = `/teacher/classes/${classroomId}/home-learning`;
  await enforceOrRedirect(path, async () => {
    await enforceRateLimit({ scope: "teacher-delete-home-resource", limit: 30, windowSeconds: 60 * 60, identifier: teacher.id });
  });
  const resource = await prisma.atHomeResource.findFirst({
    where: { id: resourceId, classroomId, teacherId: teacher.id }
  });
  if (!resource) errorRedirect(path, "At-home resource not found.");
  await prisma.atHomeResource.delete({ where: { id: resource.id } });
  redirect(`${path}?deleted=1`);
}

export async function publishMaterial(formData: FormData) {
  const teacher = await requireTeacher();
  const classroomId = formText(formData, "classroomId");
  const materialId = formText(formData, "materialId");
  await enforceOrRedirect(`/teacher/classes/${classroomId}/materials/${materialId}/review`, async () => {
    await enforceRateLimit({ scope: "teacher-publish-material", limit: 60, windowSeconds: 60 * 60, identifier: teacher.id });
  });

  const material = await prisma.material.findFirst({
    where: { id: materialId, classroomId, teacherId: teacher.id },
    include: { questions: true }
  });
  if (!material) errorRedirect("/teacher", "Material not found.");
  if (material.questions.length < 5) {
    errorRedirect(
      `/teacher/classes/${classroomId}/materials/${materialId}/review`,
      "Add at least 5 questions before publishing."
    );
  }

  await prisma.material.update({
    where: { id: materialId },
    data: { status: MaterialStatus.PUBLISHED }
  });

  redirect(`/teacher/classes/${classroomId}`);
}

export async function unpublishMaterial(formData: FormData) {
  const teacher = await requireTeacher();
  const classroomId = formText(formData, "classroomId");
  const materialId = formText(formData, "materialId");
  await enforceOrRedirect(`/teacher/classes/${classroomId}/materials/${materialId}/review`, async () => {
    await enforceRateLimit({ scope: "teacher-unpublish-material", limit: 60, windowSeconds: 60 * 60, identifier: teacher.id });
  });

  const material = await prisma.material.findFirst({
    where: { id: materialId, classroomId, teacherId: teacher.id }
  });
  if (!material) errorRedirect("/teacher", "Material not found.");

  await prisma.material.update({
    where: { id: materialId },
    data: { status: MaterialStatus.DRAFT }
  });

  redirect(`/teacher/classes/${classroomId}/materials/${materialId}/review`);
}

export async function gradeStudentAnswer(formData: FormData) {
  const teacher = await requireTeacher();
  const classroomId = formText(formData, "classroomId");
  const materialId = formText(formData, "materialId");
  const questionId = formText(formData, "questionId");
  const answerId = formText(formData, "answerId");
  const requestedPoints = Number(formData.get("points"));
  const path = `/teacher/classes/${classroomId}/materials/${materialId}/questions/${questionId}/responses`;
  await enforceOrRedirect(path, async () => {
    await enforceRateLimit({ scope: "teacher-grade-answer", limit: 240, windowSeconds: 60 * 60, identifier: teacher.id });
  });

  if (!Number.isFinite(requestedPoints)) {
    errorRedirect(path, "Choose a point value before submitting.");
  }

  const answer = await prisma.studentAnswer.findFirst({
    where: {
      id: answerId,
      questionId,
      question: {
        material: {
          id: materialId,
          classroomId,
          teacherId: teacher.id
        }
      }
    },
    include: {
      question: { include: { material: { include: { questions: true } } } }
    }
  });
  if (!answer) errorRedirect(path, "Student response not found.");

  const maxPoints = questionPointValue(answer.question.sortOrder, answer.question.material.questions.length);
  const pointsEarned = Math.min(maxPoints, Math.max(0, Math.round(requestedPoints)));
  const isCorrect = pointsEarned === maxPoints;

  await prisma.studentAnswer.update({
    where: { id: answer.id },
    data: { isCorrect, firstTryCorrect: isCorrect && answer.attemptCount <= 1, pointsEarned }
  });

  const total = await prisma.studentAnswer.aggregate({
    where: { sessionId: answer.sessionId },
    _sum: { pointsEarned: true }
  });
  await prisma.studentSession.update({
    where: { id: answer.sessionId },
    data: { pointsEarned: total._sum.pointsEarned || 0 }
  });

  redirect(`${path}?graded=1`);
}

export async function updateTeacherPassword(formData: FormData) {
  const teacher = await requireTeacher();
  await enforceOrRedirect("/teacher/account", async () => {
    await enforceRateLimit({ scope: "teacher-password-change", limit: 5, windowSeconds: 60 * 60, identifier: teacher.id });
  });
  const confirmEmail = normalizeEmail(formText(formData, "confirmEmail"));
  const newPassword = boundedText(formData, "newPassword", 1024);
  const confirmPassword = boundedText(formData, "confirmPassword", 1024);

  if (confirmEmail !== teacher.email) {
    errorRedirect("/teacher/account", "Confirm your account email before changing the password.");
  }
  if (newPassword.length < 10) {
    errorRedirect("/teacher/account", "Use a password with at least 10 characters.");
  }
  if (newPassword !== confirmPassword) {
    errorRedirect("/teacher/account", "The new passwords do not match.");
  }

  await prisma.teacher.update({
    where: { id: teacher.id },
    data: { passwordHash: await hashPassword(newPassword) }
  });

  redirect("/teacher/account?saved=1");
}

export async function submitContactLead(formData: FormData) {
  const name = boundedText(formData, "name", 120);
  const email = normalizeEmail(formText(formData, "email"));
  const phone = normalizePhone(formText(formData, "phone"));
  const school = boundedText(formData, "school", 160);
  const gradeLevel = normalizeGrade(formText(formData, "gradeLevel"));
  const website = formText(formData, "website");

  if (website) redirect("/contact?sent=1");
  await enforceOrRedirect("/contact", async () => {
    await enforceRateLimit({ scope: "contact-ip", limit: 20, windowSeconds: 60 * 60 });
    await enforceRateLimit({ scope: "contact-email", limit: 3, windowSeconds: 24 * 60 * 60, identifier: email });
    await enforceTurnstile(formData, "contact");
  });
  if (name.length < 2 || !email.includes("@") || !gradeLevel) {
    errorRedirect("/contact", "Please share your name, email, and grade level so we can reach you.");
  }
  if (phone && phone.length < 7) {
    errorRedirect("/contact", "Enter a valid phone number or leave it blank.");
  }

  await prisma.contactLead.create({
    data: {
      name,
      email,
      phone: phone || null,
      school: school || null,
      gradeLevel
    }
  });
  redirect("/contact?sent=1");
}
