import "server-only";

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthSecret } from "@/lib/security";

const teacherCookie = "charlotte_teacher_session";
const studentCookie = "charlotte_student_session";
const studentCompletionLockCookie = "charlotte_student_completion_lock";

type TeacherJwt = {
  sub: string;
  role: "teacher";
  name: string;
  email: string;
};

type StudentJwt = {
  sub: string;
  role: "student";
  email: string;
  name: string;
  studentId?: string;
  classroomId?: string;
};

function secretKey() {
  return new TextEncoder().encode(getAuthSecret());
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

async function signToken(payload: TeacherJwt | StudentJwt, expiresIn: string) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey());
}

async function verifyToken<T>(token?: string) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload as T;
  } catch {
    return null;
  }
}

export async function setTeacherSession(teacher: {
  id: string;
  name: string;
  email: string;
}) {
  const token = await signToken(
    { sub: teacher.id, role: "teacher", name: teacher.name, email: teacher.email },
    "8h"
  );
  const cookieStore = await cookies();
  cookieStore.set(teacherCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  });
}

export async function setStudentSession(account: {
  id: string;
  displayName: string;
  email: string;
}, enrollment?: { id: string; classroomId: string }) {
  const token = await signToken(
    {
      sub: account.id,
      role: "student",
      email: account.email,
      name: account.displayName,
      studentId: enrollment?.id,
      classroomId: enrollment?.classroomId
    },
    "6h"
  );
  const cookieStore = await cookies();
  cookieStore.delete(studentCompletionLockCookie);
  cookieStore.set(studentCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 6
  });
}

export async function clearTeacherSession() {
  const cookieStore = await cookies();
  cookieStore.delete(teacherCookie);
}

export async function clearStudentSession() {
  const cookieStore = await cookies();
  cookieStore.delete(studentCookie);
  cookieStore.delete(studentCompletionLockCookie);
}

export async function setStudentCompletionLock(materialId: string) {
  const cookieStore = await cookies();
  cookieStore.set(studentCompletionLockCookie, materialId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 6
  });
}

export async function getStudentCompletionLock() {
  const cookieStore = await cookies();
  return cookieStore.get(studentCompletionLockCookie)?.value || null;
}

export async function getTeacherSession() {
  const cookieStore = await cookies();
  const jwt = await verifyToken<TeacherJwt>(cookieStore.get(teacherCookie)?.value);
  if (!jwt || jwt.role !== "teacher") return null;
  return jwt;
}

export async function getStudentSession() {
  const cookieStore = await cookies();
  const jwt = await verifyToken<StudentJwt>(cookieStore.get(studentCookie)?.value);
  if (!jwt || jwt.role !== "student") return null;
  return jwt;
}

export async function requireTeacher() {
  const session = await getTeacherSession();
  if (!session) redirect("/teacher/login");

  const teacher = await prisma.teacher.findUnique({
    where: { id: session.sub },
    select: { id: true, name: true, email: true }
  });

  if (!teacher) redirect("/teacher/login");
  return teacher;
}

export async function requireStudent() {
  const session = await getStudentSession();
  if (!session) redirect("/student/login");
  if (!session.studentId || !session.classroomId) redirect("/student/classes");

  const student = await prisma.student.findFirst({
    where: {
      id: session.studentId,
      accountId: session.sub,
      classroomId: session.classroomId,
      active: true
    },
    include: { classroom: true }
  });

  if (!student) redirect("/student/classes");
  return student;
}

export async function requireStudentAccount() {
  const session = await getStudentSession();
  if (!session) redirect("/student/login");
  const account = await prisma.studentAccount.findUnique({
    where: { id: session.sub },
    select: { id: true, displayName: true, email: true, emailKeyHash: true }
  });
  if (!account) redirect("/student/login");
  return account;
}
