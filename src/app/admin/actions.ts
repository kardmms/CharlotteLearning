"use server";

import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  clearAdminSession,
  hashPassword,
  requireAdmin,
  setAdminSession,
  verifyPassword
} from "@/lib/auth";
import { BotProtectionError, enforceTurnstile } from "@/lib/bot-protection";
import { restrictedFetch } from "@/lib/outbound";
import { clearExpiredRateLimits, enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { hashText } from "@/lib/security";

const inviteFlashCookie = "charlotte_admin_invite_flash";
const feedbackPasscodeHashKey = "feedback_passcode_hash";
const feedbackPasscodeHintKey = "feedback_passcode_hint";

function formText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function boundedText(formData: FormData, key: string, maxLength: number) {
  return formText(formData, key).slice(0, maxLength);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase().slice(0, 254);
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 40);
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

async function siteOrigin() {
  const headerStore = await headers();
  const origin = headerStore.get("origin");
  if (origin) return origin;
  const host = headerStore.get("host");
  if (host) return `https://${host}`;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function makeInviteToken() {
  return crypto.randomBytes(32).toString("base64url");
}

async function flashInviteLink(payload: {
  email: string;
  link: string;
  sent: boolean;
  message: string;
}) {
  const cookieStore = await cookies();
  cookieStore.set(inviteFlashCookie, Buffer.from(JSON.stringify(payload)).toString("base64url"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: 60 * 15
  });
}

async function sendInviteEmail(email: string, link: string, invitedByName: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ADMIN_INVITE_FROM;
  if (!apiKey || !from) {
    return {
      sent: false,
      message: "Invite link created. Add RESEND_API_KEY and ADMIN_INVITE_FROM to send email automatically."
    };
  }

  const response = await restrictedFetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Charlotte AI admin invitation",
      html: `
        <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
          <h1 style="font-size: 24px;">You were invited to Charlotte AI admin</h1>
          <p>${invitedByName} invited you to help monitor Charlotte AI.</p>
          <p><a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:700;">Create admin password</a></p>
          <p>After setup, go to the Charlotte AI homepage, scroll to the bottom, and click <strong>Admin</strong> to sign in again.</p>
          <p>This link expires in 7 days.</p>
        </div>
      `
    }),
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    return {
      sent: false,
      message: "Invite link created, but email delivery failed. Copy the link below."
    };
  }

  return { sent: true, message: "Invite email sent." };
}

export async function readInviteFlash() {
  const admin = await requireAdmin();
  void admin;
  const cookieStore = await cookies();
  const value = cookieStore.get(inviteFlashCookie)?.value;
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      email: string;
      link: string;
      sent: boolean;
      message: string;
    };
  } catch {
    return null;
  }
}

export async function loginAdmin(formData: FormData) {
  const loginPath = "/admin/login";
  const login = formText(formData, "username").toLowerCase().slice(0, 254);
  const password = boundedText(formData, "password", 1024);

  await enforceOrRedirect(loginPath, async () => {
    await enforceRateLimit({ scope: "admin-login-ip", limit: 60, windowSeconds: 60 * 60 });
    await enforceRateLimit({ scope: "admin-login-user", limit: 10, windowSeconds: 15 * 60, identifier: login });
    await enforceTurnstile(formData, "admin_login");
  });

  const adminCount = await prisma.adminUser.count();
  const admin = await prisma.adminUser.findFirst({
    where: {
      OR: [
        { username: normalizeUsername(login) },
        { email: normalizeEmail(login) }
      ]
    }
  });

  if (!admin && adminCount === 0) {
    const bootstrapEmail = normalizeEmail(process.env.ADMIN_BOOTSTRAP_EMAIL || "");
    const bootstrapUsername = normalizeUsername(
      process.env.ADMIN_BOOTSTRAP_USERNAME || bootstrapEmail.split("@")[0] || ""
    );
    const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD || "";
    const bootstrapName = (process.env.ADMIN_BOOTSTRAP_NAME || "Charlotte Admin").trim().slice(0, 120);
    const loginMatchesBootstrap =
      normalizeUsername(login) === bootstrapUsername || normalizeEmail(login) === bootstrapEmail;

    if (
      bootstrapUsername &&
      bootstrapEmail.includes("@") &&
      bootstrapPassword.length >= 12 &&
      loginMatchesBootstrap &&
      password === bootstrapPassword
    ) {
      const owner = await prisma.adminUser.create({
        data: {
          name: bootstrapName,
          email: bootstrapEmail,
          username: bootstrapUsername,
          role: AdminRole.OWNER,
          passwordHash: await hashPassword(password)
        }
      });
      await setAdminSession(owner);
      redirect("/admin");
    }

    errorRedirect(loginPath, "Admin owner is not configured yet.");
  }

  if (!admin) errorRedirect(loginPath, "Username or password was not recognized.");
  const ok = await verifyPassword(password, admin.passwordHash);
  if (!ok) errorRedirect(loginPath, "Username or password was not recognized.");

  await setAdminSession(admin);
  redirect("/admin");
}

export async function logoutAdmin() {
  await clearAdminSession();
  redirect("/");
}

export async function createAdminInvite(formData: FormData) {
  const admin = await requireAdmin();
  const email = normalizeEmail(formText(formData, "email"));
  const name = boundedText(formData, "name", 120);

  await enforceOrRedirect("/admin", async () => {
    await enforceRateLimit({ scope: "admin-create-invite", limit: 30, windowSeconds: 60 * 60, identifier: admin.id });
  });

  if (!email.includes("@")) errorRedirect("/admin", "Enter a valid admin email.");
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) errorRedirect("/admin", "That email already has admin access.");

  const token = makeInviteToken();
  const link = `${await siteOrigin()}/admin/invite/${token}`;
  const delivery = await sendInviteEmail(email, link, admin.name);

  await prisma.adminInvite.create({
    data: {
      email,
      name: name || null,
      tokenHash: hashText(token),
      invitedById: admin.id,
      sentAt: delivery.sent ? new Date() : null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  await flashInviteLink({ email, link, sent: delivery.sent, message: delivery.message });
  redirect("/admin?invited=1");
}

export async function acceptAdminInvite(formData: FormData) {
  const token = formText(formData, "token");
  const password = boundedText(formData, "password", 1024);
  const confirmPassword = boundedText(formData, "confirmPassword", 1024);
  const username = normalizeUsername(formText(formData, "username"));
  const name = boundedText(formData, "name", 120);
  const path = `/admin/invite/${encodeURIComponent(token)}`;

  await enforceOrRedirect(path, async () => {
    await enforceRateLimit({ scope: "admin-accept-invite", limit: 20, windowSeconds: 60 * 60, identifier: hashText(token).slice(0, 24) });
    await enforceTurnstile(formData, "admin_accept_invite");
  });

  if (username.length < 3) errorRedirect(path, "Choose a username with at least 3 letters or numbers.");
  if (name.length < 2) errorRedirect(path, "Enter your name.");
  if (password.length < 12) errorRedirect(path, "Use a password with at least 12 characters.");
  if (password !== confirmPassword) errorRedirect(path, "Passwords do not match.");

  const invite = await prisma.adminInvite.findUnique({
    where: { tokenHash: hashText(token) }
  });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    errorRedirect("/admin/login", "This admin invite is expired or already used.");
  }

  const existingUsername = await prisma.adminUser.findUnique({ where: { username } });
  if (existingUsername) errorRedirect(path, "That username is already taken.");
  const existingEmail = await prisma.adminUser.findUnique({ where: { email: invite.email } });
  if (existingEmail) errorRedirect("/admin/login", "That admin account already exists. Sign in instead.");

  const admin = await prisma.$transaction(async (tx) => {
    const created = await tx.adminUser.create({
      data: {
        name,
        email: invite.email,
        username,
        role: AdminRole.ADMIN,
        passwordHash: await hashPassword(password)
      }
    });
    await tx.adminInvite.update({
      where: { id: invite.id },
      data: {
        usedAt: new Date(),
        createdAdminId: created.id
      }
    });
    return created;
  });

  await setAdminSession(admin);
  redirect("/admin");
}

export async function updateFeedbackPasscode(formData: FormData) {
  const admin = await requireAdmin();
  const passcode = boundedText(formData, "passcode", 120);
  const hint = boundedText(formData, "hint", 120);

  await enforceOrRedirect("/admin", async () => {
    await enforceRateLimit({ scope: "admin-feedback-passcode", limit: 20, windowSeconds: 60 * 60, identifier: admin.id });
  });

  if (passcode.length < 6) errorRedirect("/admin", "Use a feedback passcode with at least 6 characters.");
  const passcodeHash = await hashPassword(passcode);

  await prisma.$transaction([
    prisma.adminSetting.upsert({
      where: { key: feedbackPasscodeHashKey },
      update: { value: passcodeHash },
      create: { key: feedbackPasscodeHashKey, value: passcodeHash }
    }),
    prisma.adminSetting.upsert({
      where: { key: feedbackPasscodeHintKey },
      update: { value: hint || null },
      create: { key: feedbackPasscodeHintKey, value: hint || null }
    })
  ]);

  redirect("/admin?feedbackPasscode=1");
}

export async function submitTeacherFeedback(formData: FormData) {
  const feedbackPath = "/feedback";
  const passcode = boundedText(formData, "passcode", 120);
  const teacherName = boundedText(formData, "teacherName", 120);
  const teacherEmail = normalizeEmail(formText(formData, "teacherEmail"));
  const schoolOrClass = boundedText(formData, "schoolOrClass", 160);
  const weekOf = boundedText(formData, "weekOf", 40);
  const strengths = boundedText(formData, "strengths", 2000);
  const struggles = boundedText(formData, "struggles", 2000);
  const improvements = boundedText(formData, "improvements", 2000);
  const rawRating = Number(formData.get("rating") ?? 3);
  const rating = Number.isFinite(rawRating) ? Math.max(1, Math.min(5, rawRating)) : 3;

  await enforceOrRedirect(feedbackPath, async () => {
    await enforceRateLimit({ scope: "teacher-feedback-ip", limit: 20, windowSeconds: 60 * 60 });
    await enforceTurnstile(formData, "teacher_feedback");
  });

  const setting = await prisma.adminSetting.findUnique({ where: { key: feedbackPasscodeHashKey } });
  if (!setting?.value) errorRedirect(feedbackPath, "Feedback passcode is not configured yet.");
  const ok = await verifyPassword(passcode, setting.value);
  if (!ok) errorRedirect(feedbackPath, "Feedback passcode was not recognized.");

  if (teacherName.length < 2) errorRedirect(feedbackPath, "Please enter your name.");
  if (teacherEmail && !teacherEmail.includes("@")) errorRedirect(feedbackPath, "Enter a valid email or leave it blank.");
  if (strengths.length < 8 || struggles.length < 8 || improvements.length < 8) {
    errorRedirect(feedbackPath, "Please write a little more in each feedback box.");
  }

  await prisma.teacherFeedback.create({
    data: {
      teacherName,
      teacherEmail: teacherEmail || null,
      schoolOrClass: schoolOrClass || null,
      weekOf: weekOf || null,
      rating,
      strengths,
      struggles,
      improvements
    }
  });

  redirect("/feedback?saved=1");
}
