"use server";

import { redirect } from "next/navigation";
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
import { clearExpiredRateLimits, enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { privacyAccountEmail, studentEmailLookupHash } from "@/lib/school-privacy";

function formText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function errorRedirect(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function boundedText(formData: FormData, key: string, maxLength: number) {
  return formText(formData, key).slice(0, maxLength);
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
  await enforceOrRedirect("/student/login", async () => {
    await enforceRateLimit({ scope: "student-login-ip", limit: 100, windowSeconds: 60 * 60 });
    await enforceRateLimit({ scope: "student-login-email", limit: 20, windowSeconds: 15 * 60, identifier: email });
    await enforceTurnstile(formData, "student_login");
  });
  if (!email.includes("@") || !password) {
    errorRedirect("/student/login", "Enter your email and password.");
  }

  const account = await prisma.studentAccount.findUnique({ where: { email } }) ||
    await prisma.studentAccount.findUnique({ where: { emailKeyHash: studentEmailLookupHash(email) } });
  if (!account || !(await verifyPassword(password, account.passwordHash))) {
    errorRedirect("/student/login", "Email or password was not recognized.");
  }

  await setStudentSession(account);
  redirect("/student/classes");
}

export async function registerStudent(formData: FormData) {
  const displayName = boundedText(formData, "displayName", 120);
  const email = normalizeStudentEmail(formText(formData, "email")).slice(0, 254);
  const password = boundedText(formData, "password", 1024);
  const confirmPassword = boundedText(formData, "confirmPassword", 1024);
  await enforceOrRedirect("/student/signup", async () => {
    await enforceRateLimit({ scope: "student-signup-ip", limit: 100, windowSeconds: 60 * 60 });
    await enforceRateLimit({ scope: "student-signup-email", limit: 6, windowSeconds: 24 * 60 * 60, identifier: email });
    await enforceTurnstile(formData, "student_signup");
  });
  if (displayName.length < 2) errorRedirect("/student/signup", "Enter your name.");
  if (!email.includes("@")) errorRedirect("/student/signup", "Enter a valid email.");
  if (password.length < 10) errorRedirect("/student/signup", "Use a password with at least 10 characters.");
  if (password !== confirmPassword) errorRedirect("/student/signup", "The passwords do not match.");

  const emailKeyHash = studentEmailLookupHash(email);
  const matchingPrivateEnrollments = await prisma.student.findMany({
    where: { emailKeyHash, active: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
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
          displayName: firstEnrollment.displayName,
          email: privacyAccountEmail(emailKeyHash),
          emailKeyHash,
          displayNameEncrypted: firstEnrollment.displayNameEncrypted,
          emailEncrypted: firstEnrollment.emailEncrypted,
          passwordHash: await hashPassword(password)
        }
      });
      await transaction.student.updateMany({
        where: { emailKeyHash, accountId: null },
        data: { accountId: created.id }
      });
      return created;
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
    return created;
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
    select: { id: true, classroomId: true }
  });
  if (!enrollment) errorRedirect("/student/classes", "That class enrollment is not available.");
  await setStudentSession(account, enrollment);
  redirect("/student");
}

export async function logoutStudent() {
  await clearStudentSession();
  redirect("/");
}
