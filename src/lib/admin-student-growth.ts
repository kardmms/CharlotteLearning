import "server-only";

import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { getAuthSecret } from "@/lib/security";

export type AdminStudentGrowthRow = {
  protectedId: string;
  assessedAssignments: number;
  recentAverage: number | null;
  change: number | null;
  status: "growing" | "needs_attention" | "steady" | "not_enough_data";
};

export function protectedStudentId(studentId: string, secret: string) {
  return crypto.createHmac("sha256", secret)
    .update(`admin-student-growth:${studentId}`)
    .digest("hex")
    .slice(0, 16)
    .toUpperCase();
}

export function studentGrowthSummary(scoresNewestFirst: number[]) {
  const scores = scoresNewestFirst.slice(0, 6).map((score) => Math.max(0, Math.min(100, score)));
  if (!scores.length) return { assessedAssignments: 0, recentAverage: null, change: null, status: "not_enough_data" as const };
  const recent = scores.slice(0, 3);
  const older = scores.slice(3, 6);
  const recentAverage = Math.round(recent.reduce((sum, score) => sum + score, 0) / recent.length);
  const change = recent.length === 3 && older.length === 3
    ? recentAverage - Math.round(older.reduce((sum, score) => sum + score, 0) / 3)
    : null;
  const status: AdminStudentGrowthRow["status"] = recent.length < 3 ? "not_enough_data" :
    recentAverage < 60 || (change !== null && change <= -5) ? "needs_attention" :
    change !== null && change >= 5 ? "growing" : "steady";
  return { assessedAssignments: scores.length, recentAverage, change, status };
}

export async function getAdminStudentGrowth(): Promise<AdminStudentGrowthRow[]> {
  const students = await prisma.student.findMany({
    where: { active: true, classroom: { teacher: { isShowcase: false } } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      sessions: {
        where: { status: "COMPLETED", material: { activityKind: "IN_CLASS" } },
        orderBy: { completedAt: "desc" },
        take: 12,
        select: { pointsEarned: true, answers: { select: { isCorrect: true } } }
      }
    }
  });
  const secret = getAuthSecret();
  return students.map((student) => {
    const scores = student.sessions
      .filter((session) => session.answers.length > 0 && session.answers.every((answer) => answer.isCorrect !== null))
      .slice(0, 6)
      .map((session) => session.pointsEarned);
    return { protectedId: protectedStudentId(student.id, secret), ...studentGrowthSummary(scores) };
  }).sort((a, b) => {
    const weight = { needs_attention: 0, growing: 1, steady: 2, not_enough_data: 3 };
    return weight[a.status] - weight[b.status] || a.protectedId.localeCompare(b.protectedId);
  });
}
