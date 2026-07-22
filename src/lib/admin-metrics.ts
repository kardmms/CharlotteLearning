import "server-only";

import { prisma } from "@/lib/db";

const dayMs = 24 * 60 * 60 * 1000;
const feedbackPasscodeHashKey = "feedback_passcode_hash";
const feedbackPasscodeHintKey = "feedback_passcode_hint";

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function shortDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function recentDayStarts(days: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: days }).map((_, index) => (
    new Date(today.getTime() - (days - 1 - index) * dayMs)
  ));
}

function bucketByDay<T>(items: T[], days: number, getDate: (item: T) => Date) {
  const starts = recentDayStarts(days);
  return starts.map((start) => {
    const end = new Date(start.getTime() + dayMs);
    return {
      label: shortDate(start),
      value: items.filter((item) => {
        const date = getDate(item);
        return date >= start && date < end;
      }).length
    };
  });
}

function timeAgo(date: Date) {
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.round(diff / (60 * 1000)));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export async function getFeedbackSettings() {
  const [passcode, hint] = await Promise.all([
    prisma.adminSetting.findUnique({ where: { key: feedbackPasscodeHashKey } }),
    prisma.adminSetting.findUnique({ where: { key: feedbackPasscodeHintKey } })
  ]);

  return {
    configured: Boolean(passcode?.value),
    hint: hint?.value || ""
  };
}

export async function getAdminMetrics() {
  const now = new Date();
  const since24h = new Date(now.getTime() - dayMs);
  const since7d = new Date(now.getTime() - 7 * dayMs);
  const since14d = new Date(now.getTime() - 14 * dayMs);
  const since30d = new Date(now.getTime() - 30 * dayMs);

  const [
    totalTeachers,
    totalStudentAccounts,
    activeStudentRows,
    totalClasses,
    archivedClasses,
    totalStudents,
    totalMaterials,
    publishedMaterials,
    homeMaterials,
    totalSessions,
    completedSessions,
    totalAnswers,
    correctAnswers,
    firstTryAnswers,
    focusAlerts,
    contactLeads,
    feedbackCount,
    recentTeachers,
    recentClasses,
    recentStudents,
    recentMaterials,
    recentSessions,
    recentFeedback,
    recentContacts,
    activeTeacherMaterials,
    activeTeacherClasses,
    chartTeachers,
    chartClasses,
    chartStudents,
    chartSessions,
    gradeGroups,
    invites,
    admins,
    feedback,
    classrooms,
    settings
  ] = await Promise.all([
    prisma.teacher.count(),
    prisma.studentAccount.count(),
    prisma.studentSession.findMany({
      where: { lastSeenAt: { gte: since7d } },
      select: { studentId: true, student: { select: { accountId: true } } }
    }),
    prisma.classroom.count(),
    prisma.classroom.count({ where: { archivedAt: { not: null } } }),
    prisma.student.count({ where: { active: true } }),
    prisma.material.count(),
    prisma.material.count({ where: { status: "PUBLISHED" } }),
    prisma.material.count({ where: { activityKind: "AT_HOME" } }),
    prisma.studentSession.count(),
    prisma.studentSession.count({ where: { status: "COMPLETED" } }),
    prisma.studentAnswer.count(),
    prisma.studentAnswer.count({ where: { isCorrect: true } }),
    prisma.studentAnswer.count({ where: { firstTryCorrect: true } }),
    prisma.studentSession.count({ where: { focusViolationCount: { gt: 0 } } }),
    prisma.contactLead.count(),
    prisma.teacherFeedback.count(),
    prisma.teacher.findMany({ where: { createdAt: { gte: since14d } }, select: { createdAt: true } }),
    prisma.classroom.findMany({ where: { createdAt: { gte: since14d } }, select: { createdAt: true } }),
    prisma.student.findMany({ where: { createdAt: { gte: since14d } }, select: { createdAt: true } }),
    prisma.material.findMany({ where: { createdAt: { gte: since14d } }, select: { createdAt: true } }),
    prisma.studentSession.findMany({ where: { signInAt: { gte: since14d } }, select: { signInAt: true } }),
    prisma.teacherFeedback.findMany({ where: { createdAt: { gte: since14d } }, select: { createdAt: true } }),
    prisma.contactLead.findMany({ where: { createdAt: { gte: since14d } }, select: { createdAt: true } }),
    prisma.material.findMany({ where: { updatedAt: { gte: since30d } }, select: { teacherId: true } }),
    prisma.classroom.findMany({ where: { createdAt: { gte: since30d } }, select: { teacherId: true } }),
    prisma.teacher.findMany({ where: { createdAt: { gte: since14d } }, select: { createdAt: true } }),
    prisma.classroom.findMany({ where: { createdAt: { gte: since14d } }, select: { createdAt: true } }),
    prisma.student.findMany({ where: { createdAt: { gte: since14d } }, select: { createdAt: true } }),
    prisma.studentSession.findMany({ where: { signInAt: { gte: since14d } }, select: { signInAt: true } }),
    prisma.classroom.groupBy({
      by: ["gradeLevel"],
      where: { archivedAt: null },
      _count: { _all: true }
    }),
    prisma.adminInvite.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { invitedBy: { select: { name: true, email: true } } }
    }),
    prisma.adminUser.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, username: true, role: true, createdAt: true }
    }),
    prisma.teacherFeedback.findMany({
      take: 8,
      orderBy: { createdAt: "desc" }
    }),
    prisma.classroom.findMany({
      where: { archivedAt: null },
      take: 24,
      orderBy: { createdAt: "desc" },
      include: {
        teacher: { select: { name: true, email: true } },
        _count: { select: { students: true } },
        materials: {
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            _count: { select: { sessions: true } }
          }
        }
      }
    }),
    getFeedbackSettings()
  ]);

  const activeTeacherIds = new Set([
    ...activeTeacherMaterials.map((item) => item.teacherId),
    ...activeTeacherClasses.map((item) => item.teacherId)
  ]);
  const activeStudentIds = new Set(activeStudentRows.map((item) => item.student.accountId || item.studentId));
  const totalActiveUsers = activeTeacherIds.size + activeStudentIds.size;
  const todaySessions = await prisma.studentSession.count({ where: { signInAt: { gte: since24h } } });
  const todayAnswers = await prisma.studentAnswer.count({ where: { createdAt: { gte: since24h } } });

  const activityTimeline = [
    ...recentTeachers.map((item) => ({ label: "Teacher joined", when: item.createdAt })),
    ...recentClasses.map((item) => ({ label: "Class created", when: item.createdAt })),
    ...recentStudents.map((item) => ({ label: "Student added", when: item.createdAt })),
    ...recentMaterials.map((item) => ({ label: "Assignment created", when: item.createdAt })),
    ...recentSessions.map((item) => ({ label: "Student session", when: item.signInAt })),
    ...recentFeedback.map((item) => ({ label: "Teacher feedback", when: item.createdAt })),
    ...recentContacts.map((item) => ({ label: "Contact lead", when: item.createdAt }))
  ]
    .sort((a, b) => b.when.getTime() - a.when.getTime())
    .slice(0, 12)
    .map((item) => ({
      label: item.label,
      time: timeAgo(item.when),
      timestamp: item.when.toISOString()
    }));

  const topClassrooms = classrooms
    .map((classroom) => ({
      id: classroom.id,
      name: classroom.name,
      gradeLevel: classroom.gradeLevel,
      teacher: classroom.teacher.name,
      teacherEmail: classroom.teacher.email,
      students: classroom._count.students,
      assignments: classroom.materials.length,
      sessions: classroom.materials.reduce((sum, material) => sum + material._count.sessions, 0),
      latestAssignment: classroom.materials[0]?.title || "No assignments yet"
    }))
    .sort((a, b) => (b.students + b.sessions) - (a.students + a.sessions))
    .slice(0, 8);

  return {
    generatedAt: now.toISOString(),
    headline: {
      totalActiveUsers,
      activeTeachers: activeTeacherIds.size,
      activeStudents: activeStudentIds.size,
      totalTeachers,
      totalStudentAccounts,
      totalClasses,
      archivedClasses,
      totalStudents,
      totalMaterials,
      publishedMaterials,
      homeMaterials,
      totalSessions,
      completedSessions,
      completionRate: pct(completedSessions, totalSessions),
      totalAnswers,
      correctRate: pct(correctAnswers, totalAnswers),
      firstTryRate: pct(firstTryAnswers, totalAnswers),
      focusAlerts,
      contactLeads,
      feedbackCount,
      todaySessions,
      todayAnswers
    },
    charts: {
      teachers: bucketByDay(chartTeachers, 14, (item) => item.createdAt),
      classes: bucketByDay(chartClasses, 14, (item) => item.createdAt),
      students: bucketByDay(chartStudents, 14, (item) => item.createdAt),
      sessions: bucketByDay(chartSessions, 14, (item) => item.signInAt),
      gradeMix: gradeGroups
        .map((item) => ({ label: item.gradeLevel, value: item._count._all }))
        .sort((a, b) => b.value - a.value),
      assignmentMix: [
        { label: "Published", value: publishedMaterials },
        { label: "Draft", value: Math.max(0, totalMaterials - publishedMaterials) },
        { label: "At home", value: homeMaterials }
      ]
    },
    topClassrooms,
    activityTimeline,
    feedback: feedback.map((item) => ({
      id: item.id,
      teacherName: item.teacherName,
      teacherEmail: item.teacherEmail,
      schoolOrClass: item.schoolOrClass,
      weekOf: item.weekOf,
      rating: item.rating,
      strengths: item.strengths,
      struggles: item.struggles,
      improvements: item.improvements,
      createdAt: item.createdAt.toISOString(),
      time: timeAgo(item.createdAt)
    })),
    invites: invites.map((invite) => ({
      id: invite.id,
      email: invite.email,
      name: invite.name,
      invitedBy: invite.invitedBy.name,
      sent: Boolean(invite.sentAt),
      used: Boolean(invite.usedAt),
      expired: invite.expiresAt < now,
      createdAt: invite.createdAt.toISOString(),
      expiresAt: invite.expiresAt.toISOString()
    })),
    admins: admins.map((admin) => ({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      username: admin.username,
      role: admin.role,
      createdAt: admin.createdAt.toISOString()
    })),
    settings
  };
}

export type AdminMetrics = Awaited<ReturnType<typeof getAdminMetrics>>;
