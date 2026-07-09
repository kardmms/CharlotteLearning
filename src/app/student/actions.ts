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
import { normalizeStudentEmail } from "@/lib/codes";

function formText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function errorRedirect(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function loginStudent(formData: FormData) {
  const email = normalizeStudentEmail(formText(formData, "email"));
  const password = formText(formData, "password");
  if (!email.includes("@") || !password) {
    errorRedirect("/student/login", "Enter your email and password.");
  }

  const account = await prisma.studentAccount.findUnique({ where: { email } });
  if (!account || !(await verifyPassword(password, account.passwordHash))) {
    errorRedirect("/student/login", "Email or password was not recognized.");
  }

  await setStudentSession(account);
  redirect("/student/classes");
}

export async function registerStudent(formData: FormData) {
  const displayName = formText(formData, "displayName");
  const email = normalizeStudentEmail(formText(formData, "email"));
  const password = formText(formData, "password");
  const confirmPassword = formText(formData, "confirmPassword");
  if (displayName.length < 2) errorRedirect("/student/signup", "Enter your name.");
  if (!email.includes("@")) errorRedirect("/student/signup", "Enter a valid email.");
  if (password.length < 10) errorRedirect("/student/signup", "Use a password with at least 10 characters.");
  if (password !== confirmPassword) errorRedirect("/student/signup", "The passwords do not match.");

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
