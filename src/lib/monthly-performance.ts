import "server-only";

import { prisma } from "@/lib/db";

export type MonthlyPerformanceSession = {
  studentId: string;
  status: string;
  pointsEarned: number;
  signInAt: Date;
  lastSeenAt: Date;
  signedOutAt: Date | null;
  completedAt: Date | null;
};

export type MonthlyPerformanceMaterial = {
  id: string;
  createdAt: Date;
  sessions: MonthlyPerformanceSession[];
};

export type MonthlyScore = {
  key: string;
  label: string;
  shortLabel: string;
  average: number | null;
  assignmentCount: number;
  scoredAssignmentCount: number;
};

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date, month: "short" | "long") {
  return new Intl.DateTimeFormat("en-US", {
    month,
    year: month === "long" ? "numeric" : undefined,
    timeZone: "UTC"
  }).format(date);
}

export function recentMonthStarts(count: number, now = new Date()) {
  const current = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return Array.from({ length: count }, (_, index) => (
    new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - (count - 1 - index), 1))
  ));
}

function sessionTime(session: MonthlyPerformanceSession) {
  return (
    session.completedAt?.getTime() ??
    session.signedOutAt?.getTime() ??
    session.lastSeenAt.getTime() ??
    session.signInAt.getTime()
  );
}

function latestFinalizedScores(material: MonthlyPerformanceMaterial) {
  const scores = new Map<string, { score: number; timestamp: number }>();
  for (const session of material.sessions) {
    if (session.status !== "COMPLETED" && session.status !== "PARTIAL") continue;
    const timestamp = sessionTime(session);
    const existing = scores.get(session.studentId);
    if (!existing || timestamp > existing.timestamp) {
      scores.set(session.studentId, {
        score: Math.max(0, Math.min(100, session.pointsEarned)),
        timestamp
      });
    }
  }
  return new Map([...scores].map(([studentId, value]) => [studentId, value.score]));
}

function average(values: number[]) {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function buildMonthlyClassScores(
  materials: MonthlyPerformanceMaterial[],
  count = 6,
  now = new Date()
): MonthlyScore[] {
  const scoreMaps = new Map(materials.map((material) => [material.id, latestFinalizedScores(material)]));
  return recentMonthStarts(count, now).map((start) => {
    const key = monthKey(start);
    const assigned = materials.filter((material) => monthKey(material.createdAt) === key);
    const assignmentAverages = assigned.flatMap((material) => {
      const scores = [...(scoreMaps.get(material.id)?.values() ?? [])];
      const value = average(scores);
      return value === null ? [] : [value];
    });
    return {
      key,
      label: monthLabel(start, "long"),
      shortLabel: monthLabel(start, "short"),
      average: average(assignmentAverages),
      assignmentCount: assigned.length,
      scoredAssignmentCount: assignmentAverages.length
    };
  });
}

export function buildStudentMonthlyScores(
  materials: MonthlyPerformanceMaterial[],
  studentIds: string[],
  count = 6,
  now = new Date()
) {
  const months = recentMonthStarts(count, now);
  const scoreMaps = new Map(materials.map((material) => [material.id, latestFinalizedScores(material)]));
  return studentIds.map((studentId) => ({
    studentId,
    months: months.map((start) => {
      const key = monthKey(start);
      const assigned = materials.filter((material) => monthKey(material.createdAt) === key);
      const scores = assigned.flatMap((material) => {
        const score = scoreMaps.get(material.id)?.get(studentId);
        return score === undefined ? [] : [score];
      });
      return {
        key,
        label: monthLabel(start, "long"),
        shortLabel: monthLabel(start, "short"),
        average: average(scores),
        assignmentCount: scores.length
      };
    })
  }));
}

export async function getClassroomMonthlyPerformance(classroomId: string, now = new Date()) {
  const firstMonth = recentMonthStarts(6, now)[0];
  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, teacher: { isShowcase: false } },
    select: {
      id: true,
      name: true,
      gradeLevel: true,
      identityMode: true,
      privacyKeyHint: true,
      teacher: { select: { name: true } },
      students: {
        where: { active: true },
        orderBy: { displayName: "asc" },
        select: { id: true, displayName: true }
      },
      materials: {
        where: {
          status: "PUBLISHED",
          activityKind: "IN_CLASS",
          isAdaptiveHome: false,
          createdAt: { gte: firstMonth }
        },
        select: {
          id: true,
          createdAt: true,
          sessions: {
            where: { status: { in: ["COMPLETED", "PARTIAL"] } },
            select: {
              studentId: true,
              status: true,
              pointsEarned: true,
              signInAt: true,
              lastSeenAt: true,
              signedOutAt: true,
              completedAt: true
            }
          }
        }
      }
    }
  });
  if (!classroom) return null;

  const months = buildMonthlyClassScores(classroom.materials, 6, now);
  const studentScores = buildStudentMonthlyScores(
    classroom.materials,
    classroom.students.map((student) => student.id),
    6,
    now
  );
  const scoreByStudent = new Map(studentScores.map((student) => [student.studentId, student.months]));

  return {
    id: classroom.id,
    name: classroom.name,
    gradeLevel: classroom.gradeLevel,
    teacherName: classroom.teacher.name,
    isPrivacyProtected: classroom.identityMode === "SCHOOL_KEY",
    privacyKeyHint: classroom.privacyKeyHint,
    months,
    students: classroom.students.map((student, index) => ({
      id: student.id,
      label: classroom.identityMode === "SCHOOL_KEY" ? student.displayName : `Student ${index + 1}`,
      months: scoreByStudent.get(student.id) ?? []
    }))
  };
}
