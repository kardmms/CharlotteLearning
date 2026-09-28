import type { Prisma } from "@prisma/client";
import { QUESTION_CATEGORIES, deriveCategoryRanks, type AssessmentCategory } from "@/lib/adaptive-assessment";

export async function ensureStudentCategoryRanks(db: Prisma.TransactionClient, studentId: string) {
  await db.studentCategoryRank.createMany({
    data: QUESTION_CATEGORIES.map((category) => ({ studentId, category, level: 3 })),
    skipDuplicates: true
  });
}

export async function currentStudentCategoryRanks(db: Prisma.TransactionClient, studentId: string) {
  await ensureStudentCategoryRanks(db, studentId);
  const rows = await db.studentCategoryRank.findMany({ where: { studentId } });
  return Object.fromEntries(rows.map((row) => [row.category, row.level])) as Record<AssessmentCategory, number>;
}

export async function refreshStudentCategoryRanks(db: Prisma.TransactionClient, studentId: string, schoolId: string) {
  const sessions = await db.studentSession.findMany({
    where: {
      studentId,
      schoolId,
      status: "COMPLETED",
      material: { adaptiveQuestionSet: true }
    },
    orderBy: [{ completedAt: "asc" }, { id: "asc" }],
    include: {
      material: { select: { questions: { select: { id: true, category: true, difficulty: true } } } },
      answers: { select: { questionId: true, isCorrect: true } }
    }
  });
  const { levels, counts } = deriveCategoryRanks(sessions.map((session) => ({
    questions: session.material.questions,
    assignedQuestionIdsJson: session.assignedQuestionIdsJson,
    answers: session.answers
  })));

  await ensureStudentCategoryRanks(db, studentId);
  for (const category of QUESTION_CATEGORIES) {
    await db.studentCategoryRank.update({
      where: { studentId_category: { studentId, category } },
      data: { level: levels[category], assessedCount: counts[category] }
    });
  }
  return levels;
}
