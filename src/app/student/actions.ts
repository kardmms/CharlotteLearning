"use server";

import { redirect } from "next/navigation";
import { saveCosmeticLook } from "@/lib/cosmetic-purchase";
import { auditEventData } from "@/lib/audit";
import { prisma } from "@/lib/db";
import {
  clearStudentSession,
  hashPassword,
  requireStudentAccount,
  setStudentSession,
  verifyPassword
} from "@/lib/auth";
import { BotProtectionError, enforceTurnstile } from "@/lib/bot-protection";
import { normalizeStudentEmail } from "@/lib/codes";
import { gamesFeatureEnabled } from "@/lib/features";
import { clearExpiredRateLimits, enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { privacyAccountEmail, studentEmailLookupHash } from "@/lib/school-privacy";
import { billingEnabled, LicenseError, redeemLicense } from "@/lib/licensing";
import {
  joinCode,
  shuffledTermIds,
  vocabDashColors
} from "@/lib/vocab-dash";

function formText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function errorRedirect(path: string, message: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}error=${encodeURIComponent(message)}`);
}

function boundedText(formData: FormData, key: string, maxLength: number) {
  return formText(formData, key).slice(0, maxLength);
}

function safeStudentNext(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/student/classes";
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

export async function loginStudent(formData: FormData) {
  const email = normalizeStudentEmail(formText(formData, "email")).slice(0, 254);
  const password = boundedText(formData, "password", 1024);
  const next = safeStudentNext(formText(formData, "next"));
  const loginPath = `/student/login?next=${encodeURIComponent(next)}`;
  await enforceOrRedirect(loginPath, async () => {
    await enforceRateLimit({ scope: "student-login-ip", limit: 100, windowSeconds: 60 * 60 });
    await enforceRateLimit({ scope: "student-login-email", limit: 20, windowSeconds: 15 * 60, identifier: email });
    await enforceTurnstile(formData, "student_login");
  });
  if (!email.includes("@") || !password) {
    errorRedirect(loginPath, "Enter your email and password.");
  }

  const account = await prisma.studentAccount.findUnique({ where: { email } }) ||
    await prisma.studentAccount.findUnique({ where: { emailKeyHash: studentEmailLookupHash(email) } });
  if (!account || !(await verifyPassword(password, account.passwordHash))) {
    errorRedirect(loginPath, "Email or password was not recognized.");
  }

  await setStudentSession(account);
  redirect(next);
}

export async function registerStudent(formData: FormData) {
  const displayName = boundedText(formData, "displayName", 120);
  const email = normalizeStudentEmail(formText(formData, "email")).slice(0, 254);
  const password = boundedText(formData, "password", 1024);
  const confirmPassword = boundedText(formData, "confirmPassword", 1024);
  const licenseKey = boundedText(formData, "licenseKey", 64);
  await enforceOrRedirect("/student/signup", async () => {
    await enforceRateLimit({ scope: "student-signup-ip", limit: 100, windowSeconds: 60 * 60 });
    await enforceRateLimit({ scope: "student-signup-email", limit: 6, windowSeconds: 24 * 60 * 60, identifier: email });
    await enforceTurnstile(formData, "student_signup");
  });
  if (displayName.length < 2) errorRedirect("/student/signup", "Enter your name.");
  if (!email.includes("@")) errorRedirect("/student/signup", "Enter a valid email.");
  if (password.length < 10) errorRedirect("/student/signup", "Use a password with at least 10 characters.");
  if (password !== confirmPassword) errorRedirect("/student/signup", "The passwords do not match.");
  if (billingEnabled() && !licenseKey) errorRedirect("/student/signup", "Enter your teacher's license key.");

  const emailKeyHash = studentEmailLookupHash(email);
  const matchingPrivateEnrollments = await prisma.student.findMany({
    where: { emailKeyHash, active: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      schoolId: true,
      classroomId: true,
      accountId: true,
      displayName: true,
      displayNameEncrypted: true,
      emailEncrypted: true
    }
  });

  if (matchingPrivateEnrollments.length) {
    if (matchingPrivateEnrollments.some((enrollment) => enrollment.accountId)) {
      errorRedirect("/student/login", "An account already exists for this email. Sign in instead.");
    }
    if (await prisma.studentAccount.findUnique({ where: { emailKeyHash } })) {
      errorRedirect("/student/login", "An account already exists for this email. Sign in instead.");
    }

    const firstEnrollment = matchingPrivateEnrollments[0];
    const account = await prisma.$transaction(async (transaction) => {
      const created = await transaction.studentAccount.create({
        data: {
          displayName,
          email: privacyAccountEmail(emailKeyHash),
          emailKeyHash,
          displayNameEncrypted: firstEnrollment.displayNameEncrypted,
          emailEncrypted: firstEnrollment.emailEncrypted,
          passwordHash: await hashPassword(password)
        }
      });
      await transaction.student.updateMany({
        where: { emailKeyHash, accountId: null },
        data: { accountId: created.id, displayName, email }
      });
      if (billingEnabled()) await redeemLicense(transaction, created.id, licenseKey);
      await transaction.auditEvent.create({
        data: auditEventData({
          schoolId: firstEnrollment.schoolId,
          actorType: "student",
          actorId: created.id,
          action: "student_account.created",
          targetType: "student_account",
          targetId: created.id,
          metadata: { identityMode: "SCHOOL_KEY" }
        })
      });
      return created;
    }, { isolationLevel: "Serializable" }).catch((error) => {
      if (error instanceof LicenseError) errorRedirect("/student/signup", error.message);
      throw error;
    });
    await setStudentSession(account);
    redirect("/student/classes");
  }

  const enrollmentCount = await prisma.student.count({ where: { email, active: true } });
  if (!enrollmentCount) {
    errorRedirect("/student/signup", "A teacher must add this email to a class before you create an account.");
  }
  if (await prisma.studentAccount.findUnique({ where: { email } })) {
    errorRedirect("/student/login", "An account already exists for this email. Sign in instead.");
  }

  const account = await prisma.$transaction(async (transaction) => {
    const created = await transaction.studentAccount.create({
      data: { displayName, email, passwordHash: await hashPassword(password) }
    });
    await transaction.student.updateMany({
      where: { email, accountId: null },
      data: { accountId: created.id }
    });
    if (billingEnabled()) await redeemLicense(transaction, created.id, licenseKey);
    await transaction.auditEvent.create({
      data: auditEventData({
        actorType: "student",
        actorId: created.id,
        action: "student_account.created",
        targetType: "student_account",
        targetId: created.id,
        metadata: { identityMode: "STANDARD" }
      })
    });
    return created;
  }, { isolationLevel: "Serializable" }).catch((error) => {
    if (error instanceof LicenseError) errorRedirect("/student/signup", error.message);
    throw error;
  });
  await setStudentSession(account);
  redirect("/student/classes");
}

export async function selectStudentClassroom(formData: FormData) {
  const account = await requireStudentAccount();
  await enforceOrRedirect("/student/classes", async () => {
    await enforceRateLimit({ scope: "student-select-class", limit: 60, windowSeconds: 60 * 60, identifier: account.id });
  });
  const enrollmentId = formText(formData, "enrollmentId");
  const enrollment = await prisma.student.findFirst({
    where: { id: enrollmentId, accountId: account.id, active: true },
    select: { id: true, classroomId: true, schoolId: true, classroom: { select: { teacherId: true, teacher: { select: { isShowcase: true } } } } }
  });
  if (!enrollment) errorRedirect("/student/classes", "That class enrollment is not available.");
  if (billingEnabled() && !enrollment.classroom.teacher.isShowcase) {
    const licensed = await prisma.studentLicense.findUnique({
      where: { teacherId_accountId: { teacherId: enrollment.classroom.teacherId, accountId: account.id } },
      include: { license: { select: { status: true } } }
    });
    if (licensed?.license.status !== "active" || !licensed.active) errorRedirect("/student/classes", "Your teacher needs an active student seat for this class.");
  }
  await setStudentSession(account, enrollment);
  redirect("/student");
}

export async function redeemStudentClassLicense(formData: FormData) {
  const account = await requireStudentAccount();
  if (!billingEnabled()) redirect("/student/classes");
  const enrollmentId = formText(formData, "enrollmentId");
  const key = boundedText(formData, "licenseKey", 64);
  await enforceOrRedirect("/student/classes", async () => {
    await enforceRateLimit({ scope: "student-license-key", limit: 10, windowSeconds: 60 * 60, identifier: account.id });
  });
  const enrollment = await prisma.student.findFirst({
    where: { id: enrollmentId, accountId: account.id, active: true },
    select: { classroom: { select: { teacherId: true } } }
  });
  if (!enrollment) errorRedirect("/student/classes", "That class enrollment is not available.");
  try {
    await prisma.$transaction((transaction) => redeemLicense(transaction, account.id, key, enrollment.classroom.teacherId), {
      isolationLevel: "Serializable"
    });
  } catch (error) {
    if (error instanceof LicenseError) errorRedirect("/student/classes", error.message);
    throw error;
  }
  redirect("/student/classes");
}

export async function logoutStudent() {
  await clearStudentSession();
  redirect("/");
}

export async function joinVocabDashRoom(formData: FormData) {
  const account = await requireStudentAccount();
  if (!gamesFeatureEnabled()) redirect("/student");
  const code = joinCode(formText(formData, "code"));
  await enforceOrRedirect("/play", async () => {
    await enforceRateLimit({ scope: "vocab-dash-join-ip", limit: 80, windowSeconds: 60 * 60 });
  });

  if (code.length !== 6) errorRedirect("/play", "Enter the 6-digit game code.");

  const room = await prisma.gameRoom.findFirst({
    where: {
      code,
      kind: "VOCAB_DASH",
      status: { in: ["WAITING", "STARTING"] }
    },
    include: {
      vocabTerms: { orderBy: { sortOrder: "asc" } },
      _count: { select: { vocabTerms: true } }
    }
  });
  if (!room) errorRedirect("/play", "That Vocab Dash room is not open.");
  if (room._count.vocabTerms < 10) errorRedirect("/play", "That room is not ready yet.");

  const enrollment = await prisma.student.findFirst({
    where: {
      accountId: account.id,
      schoolId: room.schoolId,
      classroomId: room.classroomId || undefined,
      active: true
    },
    select: { id: true, schoolId: true, classroomId: true }
  });
  if (!enrollment) {
    errorRedirect("/play", "This game belongs to a class you are not enrolled in.");
  }

  // Serialize joins with starting, ending, and answering in the same room.
  // A double-click must reconnect to one player, never award two placements.
  const participant = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "GameRoom" WHERE "id" = ${room.id} FOR UPDATE`;
    const currentRoom = await transaction.gameRoom.findUnique({
      where: { id: room.id },
      include: { vocabTerms: { orderBy: { sortOrder: "asc" } } }
    });
    if (!currentRoom || currentRoom.status === "COMPLETED") return null;
    const existing = await transaction.gameParticipant.findFirst({
      where: { roomId: room.id, schoolId: room.schoolId, studentId: enrollment.id }
    });
    if (existing) {
      return transaction.gameParticipant.update({
        where: { id: existing.id },
        data: { characterColor: account.characterColor, accessoryKey: account.selectedAccessory }
      });
    }
    if (currentRoom.status !== "WAITING" || currentRoom.vocabTerms.length < 10) return null;
    const created = await transaction.gameParticipant.create({
      data: {
        schoolId: room.schoolId,
        roomId: room.id,
        studentId: enrollment.id,
        displayName: account.displayName,
        characterKey: "runner",
        characterColor: account.characterColor,
        accessoryKey: account.selectedAccessory,
        questionOrderJson: JSON.stringify(shuffledTermIds(currentRoom.vocabTerms))
      }
    });
    await transaction.auditEvent.create({
      data: auditEventData({
        schoolId: room.schoolId, actorType: "student", actorId: account.id,
        action: "game_participant.joined", targetType: "game_room", targetId: room.id,
        metadata: { kind: "VOCAB_DASH" }
      })
    });
    return created;
  });
  if (!participant) errorRedirect("/play", "That game is no longer open for joining.");

  await setStudentSession(account, enrollment);
  redirect(`/student/games/vocab-dash/play/${participant.id}`);
}

export async function updateStudentCharacter(formData: FormData) {
  const account = await requireStudentAccount();
  if (!gamesFeatureEnabled()) redirect("/student");
  const color = formText(formData, "characterColor");
  const requestedAccessory = formText(formData, "accessoryKey");
  const path = "/play";
  if (!vocabDashColors.some((item) => item.key === color)) {
    errorRedirect(path, "Choose an available character color.");
  }

  try {
    await saveCosmeticLook(prisma.studentAccount, account.id, color, requestedAccessory);
  } catch (error) {
    errorRedirect(path, error instanceof Error ? error.message : "Could not save that look.");
  }
  redirect("/play?saved=1");
}
