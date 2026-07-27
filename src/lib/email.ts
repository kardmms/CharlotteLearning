import "server-only";

import { EmailDeliveryStatus, EmailKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { restrictedFetch } from "@/lib/outbound";
import { hashText } from "@/lib/security";

type EmailResult = {
  status: "sent" | "failed" | "skipped";
  providerMessageId?: string;
  errorCode?: string;
};

type TrackedEmailInput = {
  kind: EmailKind;
  to: string;
  subject: string;
  html: string;
  text: string;
  teacherId?: string;
  studentId?: string;
  classroomId?: string;
  periodStart?: Date;
  deliveryId?: string;
};

function cleanEmail(value: string) {
  return value.trim().toLowerCase().slice(0, 254);
}

export function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function appUrl(path: string) {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "");
  if (!configured) return "";
  return new URL(path, configured.endsWith("/") ? configured : `${configured}/`).toString();
}

function emailFrame(content: string) {
  return `
    <div style="background:#f6f4ee;padding:32px 16px;font-family:Arial,sans-serif;color:#173321;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dfe8df;border-radius:18px;overflow:hidden;">
        <div style="background:#214f35;color:#ffffff;padding:22px 28px;">
          <div style="font-size:20px;font-weight:800;">Charlotte Literacy</div>
        </div>
        <div style="padding:28px;line-height:1.6;">${content}</div>
        <div style="padding:18px 28px;background:#f7faf7;color:#597060;font-size:12px;">
          This message was sent because this email is connected to a Charlotte Literacy classroom.
        </div>
      </div>
    </div>
  `;
}

function actionButton(label: string, url: string) {
  return `<p style="margin:24px 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#2f7d4a;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700;">${escapeHtml(label)}</a></p>`;
}

async function deliverEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<EmailResult> {
  if (process.env.EMAIL_DELIVERY_ENABLED !== "true") {
    return { status: "skipped", errorCode: "delivery_disabled" };
  }

  const apiKey = process.env.RESEND_API_KEY || "";
  const from = process.env.EMAIL_FROM || "";
  if (!apiKey || !from) {
    return { status: "skipped", errorCode: "provider_not_configured" };
  }

  try {
    const response = await restrictedFetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {})
      }),
      signal: AbortSignal.timeout(12_000)
    });

    if (!response.ok) {
      return { status: "failed", errorCode: `provider_http_${response.status}` };
    }

    const body = await response.json() as { id?: string };
    return { status: "sent", providerMessageId: body.id?.slice(0, 160) };
  } catch (error) {
    return {
      status: "failed",
      errorCode: error instanceof Error && error.name === "TimeoutError"
        ? "provider_timeout"
        : "provider_request_failed"
    };
  }
}

export async function sendTrackedEmail(input: TrackedEmailInput) {
  const recipient = cleanEmail(input.to);
  const subject = input.subject.replace(/[\r\n]+/g, " ").trim().slice(0, 240);
  const delivery = input.deliveryId
    ? { id: input.deliveryId }
    : await prisma.emailDelivery.create({
        data: {
          kind: input.kind,
          recipientHash: hashText(recipient),
          subject,
          teacherId: input.teacherId || null,
          studentId: input.studentId || null,
          classroomId: input.classroomId || null,
          periodStart: input.periodStart || null
        },
        select: { id: true }
      });

  const result = await deliverEmail({
    to: recipient,
    subject,
    html: input.html,
    text: input.text
  });
  const status = result.status === "sent"
    ? EmailDeliveryStatus.SENT
    : result.status === "skipped"
      ? EmailDeliveryStatus.SKIPPED
      : EmailDeliveryStatus.FAILED;

  await prisma.emailDelivery.update({
    where: { id: delivery.id },
    data: {
      status,
      providerMessageId: result.providerMessageId || null,
      errorCode: result.errorCode || null,
      sentAt: result.status === "sent" ? new Date() : null
    }
  });

  return { ...result, deliveryId: delivery.id };
}

export async function sendTeacherWelcomeEmail(teacher: {
  id: string;
  name: string;
  email: string;
}) {
  const loginUrl = appUrl("/teacher/login");
  const subject = "Welcome to Charlotte Literacy";
  const content = `
    <h1 style="font-size:26px;margin:0 0 12px;">Welcome, ${escapeHtml(teacher.name)}!</h1>
    <p>Your teacher account is ready. You can now create a class, save its recovery key, add students, and build reading practice.</p>
    ${loginUrl ? actionButton("Open your teacher account", loginUrl) : ""}
    <p style="color:#597060;">Keep each classroom recovery key somewhere secure. Charlotte cannot recover protected roster identities without it.</p>
  `;
  return sendTrackedEmail({
    kind: EmailKind.TEACHER_WELCOME,
    to: teacher.email,
    subject,
    html: emailFrame(content),
    text: `Welcome, ${teacher.name}! Your Charlotte Literacy teacher account is ready.${loginUrl ? ` Sign in: ${loginUrl}` : ""}`,
    teacherId: teacher.id
  });
}

export async function sendStudentEnrollmentEmail(input: {
  studentId: string;
  studentName: string;
  studentEmail: string;
  classroomId: string;
  classroomName: string;
  teacherId: string;
  teacherName: string;
  hasAccount: boolean;
}) {
  const path = input.hasAccount
    ? `/student/login?email=${encodeURIComponent(input.studentEmail)}`
    : `/student/signup?email=${encodeURIComponent(input.studentEmail)}&name=${encodeURIComponent(input.studentName)}`;
  const destination = appUrl(path);
  const subject = `You were added to ${input.teacherName}'s class`;
  const content = `
    <h1 style="font-size:26px;margin:0 0 12px;">You were added to ${escapeHtml(input.classroomName)}.</h1>
    <p>${escapeHtml(input.teacherName)} added you to their Charlotte Literacy class.</p>
    ${destination ? actionButton(input.hasAccount ? "Sign in to Charlotte" : "Create your Charlotte login", destination) : ""}
    <p>${input.hasAccount ? "Use your existing student email and password." : "Use this email address to create one student login for all of your Charlotte classes."}</p>
  `;
  return sendTrackedEmail({
    kind: EmailKind.STUDENT_ENROLLMENT,
    to: input.studentEmail,
    subject,
    html: emailFrame(content),
    text: `${input.teacherName} added you to ${input.classroomName}.${destination ? ` Open Charlotte: ${destination}` : ""}`,
    teacherId: input.teacherId,
    studentId: input.studentId,
    classroomId: input.classroomId
  });
}

export async function sendAdminInviteEmail(input: {
  email: string;
  invitedByName: string;
  inviteUrl: string;
}) {
  const subject = "Charlotte AI admin invitation";
  const content = `
    <h1 style="font-size:26px;margin:0 0 12px;">You were invited to Charlotte AI admin.</h1>
    <p>${escapeHtml(input.invitedByName)} invited you to help monitor Charlotte AI.</p>
    ${actionButton("Create admin password", input.inviteUrl)}
    <p>After setup, go to the Charlotte AI homepage, scroll to the bottom, and click <strong>Admin</strong> to sign in again.</p>
    <p style="color:#597060;">This one-time link expires in 7 days.</p>
  `;

  return deliverEmail({
    to: cleanEmail(input.email),
    subject,
    html: emailFrame(content),
    text: `${input.invitedByName} invited you to help monitor Charlotte AI. Create your admin account: ${input.inviteUrl} This one-time link expires in 7 days.`
  });
}

export { actionButton, emailFrame };
