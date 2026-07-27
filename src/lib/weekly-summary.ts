import "server-only";

import { EmailDeliveryStatus, EmailKind, Prisma } from "@prisma/client";
import { auditEventData } from "@/lib/audit";
import { prisma } from "@/lib/db";
import {
  appUrl,
  emailFrame,
  escapeHtml,
  sendTrackedEmail
} from "@/lib/email";
import { generateWeeklyTeacherNarrative, type WeeklyAiClassInput } from "@/lib/ai";
import { hashText } from "@/lib/security";

const dayMs = 24 * 60 * 60 * 1000;

type SkillPerformance = {
  skill: string;
  attempts: number;
  correct: number;
  accuracy: number;
};

type StudentPerformance = {
  id: string;
  name: string;
  sessions: number;
  completedSessions: number;
  gradedAnswers: number;
  correctAnswers: number;
  accuracy: number | null;
  strongestQuestionType: string | null;
  growthQuestionType: string | null;
};

type ClassPerformance = {
  id: string;
  name: string;
  gradeLevel: string;
  enrolledStudents: number;
  participatingStudents: number;
  sessions: number;
  completedSessions: number;
  gradedAnswers: number;
  correctAnswers: number;
  accuracy: number | null;
  strongestSkills: SkillPerformance[];
  growthSkills: SkillPerformance[];
  students: StudentPerformance[];
};

function startOfUtcWeek(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const mondayOffset = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - mondayOffset);
  return start;
}

export function previousWeeklyPeriod(now = new Date()) {
  const periodEnd = startOfUtcWeek(now);
  const periodStart = new Date(periodEnd.getTime() - 7 * dayMs);
  return { periodStart, periodEnd };
}

function percentage(correct: number, attempts: number) {
  return attempts ? Math.round((correct / attempts) * 100) : null;
}

function questionTypeLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sortedPerformance(map: Map<string, { attempts: number; correct: number }>) {
  return [...map.entries()]
    .map(([skill, values]) => ({
      skill,
      attempts: values.attempts,
      correct: values.correct,
      accuracy: percentage(values.correct, values.attempts) || 0
    }))
    .filter((row) => row.attempts > 0);
}

function analyzeClassroom(classroom: {
  id: string;
  name: string;
  gradeLevel: string;
  students: Array<{
    id: string;
    displayName: string;
    sessions: Array<{
      status: string;
      answers: Array<{
        isCorrect: boolean | null;
        question: { type: string; skillTag: string | null };
      }>;
    }>;
  }>;
}): ClassPerformance {
  const classSkills = new Map<string, { attempts: number; correct: number }>();
  const students = classroom.students.map((student) => {
    const byType = new Map<string, { attempts: number; correct: number }>();
    let gradedAnswers = 0;
    let correctAnswers = 0;

    for (const session of student.sessions) {
      for (const answer of session.answers) {
        if (answer.isCorrect === null) continue;
        gradedAnswers += 1;
        if (answer.isCorrect) correctAnswers += 1;

        const type = questionTypeLabel(answer.question.type);
        const typeRow = byType.get(type) || { attempts: 0, correct: 0 };
        typeRow.attempts += 1;
        if (answer.isCorrect) typeRow.correct += 1;
        byType.set(type, typeRow);

        const skill = answer.question.skillTag?.trim() || type;
        const skillRow = classSkills.get(skill) || { attempts: 0, correct: 0 };
        skillRow.attempts += 1;
        if (answer.isCorrect) skillRow.correct += 1;
        classSkills.set(skill, skillRow);
      }
    }

    const typeRows = sortedPerformance(byType);
    const strongest = [...typeRows].sort((a, b) => b.accuracy - a.accuracy || b.attempts - a.attempts)[0];
    const growth = [...typeRows].sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts)[0];

    return {
      id: student.id,
      name: student.displayName,
      sessions: student.sessions.length,
      completedSessions: student.sessions.filter((session) => session.status === "COMPLETED").length,
      gradedAnswers,
      correctAnswers,
      accuracy: percentage(correctAnswers, gradedAnswers),
      strongestQuestionType: strongest?.skill || null,
      growthQuestionType: growth?.skill || null
    };
  });

  const skillRows = sortedPerformance(classSkills);
  const gradedAnswers = students.reduce((sum, student) => sum + student.gradedAnswers, 0);
  const correctAnswers = students.reduce((sum, student) => sum + student.correctAnswers, 0);
  return {
    id: classroom.id,
    name: classroom.name,
    gradeLevel: classroom.gradeLevel,
    enrolledStudents: students.length,
    participatingStudents: students.filter((student) => student.sessions > 0).length,
    sessions: students.reduce((sum, student) => sum + student.sessions, 0),
    completedSessions: students.reduce((sum, student) => sum + student.completedSessions, 0),
    gradedAnswers,
    correctAnswers,
    accuracy: percentage(correctAnswers, gradedAnswers),
    strongestSkills: [...skillRows]
      .sort((a, b) => b.accuracy - a.accuracy || b.attempts - a.attempts)
      .slice(0, 3),
    growthSkills: [...skillRows]
      .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts)
      .slice(0, 3),
    students
  };
}

function aiInput(classes: ClassPerformance[]): WeeklyAiClassInput[] {
  return classes.map((classroom, classIndex) => ({
    label: `Class ${classIndex + 1}`,
    gradeLevel: classroom.gradeLevel,
    enrolledStudents: classroom.enrolledStudents,
    participatingStudents: classroom.participatingStudents,
    completedSessions: classroom.completedSessions,
    totalSessions: classroom.sessions,
    accuracy: classroom.accuracy,
    strongestSkills: classroom.strongestSkills.map(({ skill, accuracy, attempts }) => ({ skill, accuracy, attempts })),
    growthSkills: classroom.growthSkills.map(({ skill, accuracy, attempts }) => ({ skill, accuracy, attempts })),
    students: classroom.students.map((student, studentIndex) => ({
      label: `Student ${studentIndex + 1}`,
      sessions: student.sessions,
      accuracy: student.accuracy,
      strongestQuestionType: student.strongestQuestionType,
      growthQuestionType: student.growthQuestionType
    }))
  }));
}

function formatPeriod(start: Date, end: Date) {
  const format = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${format.format(start)}–${format.format(new Date(end.getTime() - dayMs))}`;
}

function metric(value: string | number, label: string) {
  return `<td style="padding:10px;border:1px solid #dfe8df;text-align:center;"><strong style="display:block;font-size:20px;color:#214f35;">${escapeHtml(value)}</strong><span style="font-size:12px;color:#597060;">${escapeHtml(label)}</span></td>`;
}

function studentRows(students: StudentPerformance[]) {
  return students.map((student) => `
    <tr>
      <td style="padding:9px;border-bottom:1px solid #edf1ed;font-weight:700;">${escapeHtml(student.name)}</td>
      <td style="padding:9px;border-bottom:1px solid #edf1ed;text-align:center;">${student.sessions}</td>
      <td style="padding:9px;border-bottom:1px solid #edf1ed;text-align:center;">${student.accuracy === null ? "—" : `${student.accuracy}%`}</td>
      <td style="padding:9px;border-bottom:1px solid #edf1ed;">${escapeHtml(student.strongestQuestionType || "More data needed")}</td>
      <td style="padding:9px;border-bottom:1px solid #edf1ed;">${escapeHtml(student.growthQuestionType || "More data needed")}</td>
    </tr>
  `).join("");
}

function classSection(classroom: ClassPerformance) {
  const completionRate = percentage(classroom.completedSessions, classroom.sessions);
  const strengths = classroom.strongestSkills.length
    ? classroom.strongestSkills.map((row) => `${escapeHtml(row.skill)} (${row.accuracy}%)`).join(", ")
    : "More graded responses needed";
  const growth = classroom.growthSkills.length
    ? classroom.growthSkills.map((row) => `${escapeHtml(row.skill)} (${row.accuracy}%)`).join(", ")
    : "More graded responses needed";

  return `
    <div style="margin-top:28px;padding-top:24px;border-top:2px solid #dfe8df;">
      <h2 style="margin:0 0 4px;font-size:22px;">${escapeHtml(classroom.name)}</h2>
      <p style="margin:0 0 14px;color:#597060;">Grade ${escapeHtml(classroom.gradeLevel)}</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:16px;"><tr>
        ${metric(`${classroom.participatingStudents}/${classroom.enrolledStudents}`, "Participated")}
        ${metric(classroom.sessions, "Sessions")}
        ${metric(completionRate === null ? "—" : `${completionRate}%`, "Completed")}
        ${metric(classroom.accuracy === null ? "—" : `${classroom.accuracy}%`, "Accuracy")}
      </tr></table>
      <p><strong>Strongest skills:</strong> ${strengths}</p>
      <p><strong>Growth areas:</strong> ${growth}</p>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:#f7faf7;">
            <th style="padding:9px;text-align:left;">Student</th>
            <th style="padding:9px;">Sessions</th>
            <th style="padding:9px;">Accuracy</th>
            <th style="padding:9px;text-align:left;">Strongest type</th>
            <th style="padding:9px;text-align:left;">Growth type</th>
          </tr></thead>
          <tbody>${studentRows(classroom.students)}</tbody>
        </table>
      </div>
    </div>
  `;
}

function plainTextSummary(input: {
  teacherName: string;
  period: string;
  narrative: string;
  classes: ClassPerformance[];
  dashboardUrl: string;
}) {
  const classText = input.classes.map((classroom) => [
    classroom.name,
    `${classroom.participatingStudents}/${classroom.enrolledStudents} students participated; ${classroom.sessions} sessions; ${classroom.accuracy === null ? "no graded accuracy yet" : `${classroom.accuracy}% accuracy`}.`,
    ...classroom.students.map((student) =>
      `${student.name}: ${student.sessions} sessions, ${student.accuracy === null ? "no graded accuracy" : `${student.accuracy}% accuracy`}, strength ${student.strongestQuestionType || "more data needed"}, growth area ${student.growthQuestionType || "more data needed"}.`
    )
  ].join("\n")).join("\n\n");
  return [
    `Charlotte Learning weekly summary for ${input.period}`,
    `Hello ${input.teacherName},`,
    input.narrative,
    classText,
    input.dashboardUrl ? `Open your dashboard: ${input.dashboardUrl}` : ""
  ].filter(Boolean).join("\n\n");
}

async function reserveDelivery(input: {
  teacherId: string;
  teacherEmail: string;
  periodStart: Date;
  subject: string;
}) {
  const unique = {
    kind: EmailKind.WEEKLY_TEACHER_SUMMARY,
    teacherId: input.teacherId,
    periodStart: input.periodStart
  };
  const existing = await prisma.emailDelivery.findUnique({
    where: { kind_teacherId_periodStart: unique }
  });
  if (existing?.status === EmailDeliveryStatus.SENT) return null;
  if (existing) {
    return prisma.emailDelivery.update({
      where: { id: existing.id },
      data: {
        status: EmailDeliveryStatus.PENDING,
        recipientHash: hashText(input.teacherEmail.trim().toLowerCase()),
        subject: input.subject,
        errorCode: null
      },
      select: { id: true }
    });
  }
  try {
    return await prisma.emailDelivery.create({
      data: {
        ...unique,
        recipientHash: hashText(input.teacherEmail.trim().toLowerCase()),
        subject: input.subject
      },
      select: { id: true }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
    throw error;
  }
}

export async function sendWeeklyTeacherSummaries(now = new Date()) {
  const { periodStart, periodEnd } = previousWeeklyPeriod(now);
  const teachers = await prisma.teacher.findMany({
    where: {
      weeklySummaryEnabled: true,
      classrooms: { some: { archivedAt: null } }
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      classrooms: {
        where: { archivedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          gradeLevel: true,
          students: {
            where: { active: true },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              displayName: true,
              sessions: {
                where: { signInAt: { gte: periodStart, lt: periodEnd } },
                select: {
                  status: true,
                  answers: {
                    select: {
                      isCorrect: true,
                      question: { select: { type: true, skillTag: true } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  const result = { eligible: teachers.length, sent: 0, skipped: 0, failed: 0 };
  const period = formatPeriod(periodStart, periodEnd);
  for (const teacher of teachers) {
    const subject = `Your Charlotte weekly class summary · ${period}`;
    const delivery = await reserveDelivery({
      teacherId: teacher.id,
      teacherEmail: teacher.email,
      periodStart,
      subject
    });
    if (!delivery) {
      result.skipped += 1;
      continue;
    }

    const classes = teacher.classrooms.map(analyzeClassroom);
    const narrative = await generateWeeklyTeacherNarrative({ classes: aiInput(classes) });
    const dashboardUrl = appUrl("/teacher/classes");
    const html = emailFrame(`
      <h1 style="font-size:26px;margin:0 0 6px;">Your weekly class summary</h1>
      <p style="color:#597060;margin-top:0;">${escapeHtml(period)}</p>
      <p>Hello ${escapeHtml(teacher.name)},</p>
      <div style="background:#f1f7f2;border-left:4px solid #2f7d4a;padding:16px 18px;border-radius:8px;white-space:pre-line;">${escapeHtml(narrative)}</div>
      ${classes.map(classSection).join("")}
      ${dashboardUrl ? `<p style="margin-top:28px;"><a href="${escapeHtml(dashboardUrl)}" style="color:#2f7d4a;font-weight:700;">Open your Charlotte dashboard →</a></p>` : ""}
      <p style="font-size:12px;color:#597060;">Change weekly email delivery from your teacher account settings.</p>
    `);
    const deliveryResult = await sendTrackedEmail({
      deliveryId: delivery.id,
      kind: EmailKind.WEEKLY_TEACHER_SUMMARY,
      to: teacher.email,
      subject,
      html,
      text: plainTextSummary({ teacherName: teacher.name, period, narrative, classes, dashboardUrl }),
      teacherId: teacher.id,
      periodStart
    });

    await prisma.auditEvent.create({
      data: auditEventData({
        actorType: "system",
        action: `weekly_summary.${deliveryResult.status}`,
        targetType: "teacher",
        targetId: teacher.id,
        metadata: {
          periodStart: periodStart.toISOString(),
          classCount: classes.length
        }
      })
    });
    result[deliveryResult.status === "sent" ? "sent" : deliveryResult.status === "skipped" ? "skipped" : "failed"] += 1;
  }

  return {
    ...result,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString()
  };
}
