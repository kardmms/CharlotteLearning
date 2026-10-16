import { PrismaClient } from '@prisma/client';

// Synthetic records only: this script cannot target another school or teacher.
if (process.env.POPULATE_EXPERIENCE_HISTORY !== 'true') {
  console.log('Experience demo history population skipped.');
  process.exit(0);
}
const prisma = new PrismaClient();
const count = 60;
const prefix = 'experience-history-v1';
const names = ['Alex Rivera', 'Jordan Lee', 'Sam Chen', 'Casey Morgan'];
const topics = ['Evidence and reasoning', 'Character motivations', 'Comparing perspectives', 'Cause and effect', 'Main ideas', 'Vocabulary in context', 'Summarizing a passage', 'Drawing inferences', 'Sequence of events', 'Evaluating a claim'];

function scoreFor(name, index) {
  const progress = index / (count - 1);
  if (name === 'Alex Rivera') return Math.round((30 + progress * 65) / 10) * 10;
  if (name === 'Jordan Lee') return index === count - 1 ? 30 : Math.round((100 - progress * 65) / 10) * 10;
  if (name === 'Sam Chen') return 70;
  // A decline, a recovery, then alternating highs/lows; ends with an improvement.
  if (index < 20) return Math.round((90 - index * 2) / 10) * 10;
  if (index < 40) return Math.round((40 + (index - 20) * 2.5) / 10) * 10;
  return index % 2 ? 90 : 50;
}

try {
  const school = await prisma.school.findUnique({ where: { slug: 'student-experience-demo-20261006' } });
  const teacher = await prisma.teacher.findUnique({ where: { email: 'experience.teacher.20261006@example.test' } });
  if (!school || !teacher || teacher.defaultSchoolId !== school.id) throw new Error('Expected isolated experience demo not found.');
  const classrooms = await prisma.classroom.findMany({ where: { schoolId: school.id, teacherId: teacher.id }, include: { students: true } });
  if (classrooms.length !== 2 || classrooms.some(c => c.students.length !== 4 || c.students.some(s => !names.includes(s.displayName)))) throw new Error('Demo roster differs from expected four sample students.');
  let created = 0;
  let reused = 0;
  for (const classroom of classrooms) {
    const template = await prisma.material.findFirst({ where: { classroomId: classroom.id, title: 'Start here — A shared decision', teacherId: teacher.id }, include: { questions: { orderBy: { sortOrder: 'asc' } } } });
    if (!template || template.questions.length !== 10) throw new Error('Expected ten-question demo template not found.');
    for (let index = 0; index < count; index++) {
      const id = `${prefix}-${classroom.id}-${index + 1}`;
      if (await prisma.material.findUnique({ where: { id }, select: { id: true } })) { reused++; continue; }
      // Fixed timestamps make reruns deterministic. All work is closed historical data.
      const completedAt = new Date(Date.UTC(2026, 9, 15, 20) - (count - 1 - index) * 2 * 86400000);
      await prisma.$transaction(async tx => {
        const material = await tx.material.create({ data: {
          id, schoolId: school.id, teacherId: teacher.id, classroomId: classroom.id,
          title: `Sample history ${String(index + 1).padStart(2, '0')} — ${topics[index % topics.length]}`,
          sourceName: 'Synthetic testing data — original demo passage', sourceText: template.sourceText, sourcePreview: template.sourcePreview,
          gradeLevel: classroom.gradeLevel, status: 'PUBLISHED', activityKind: 'IN_CLASS', estimatedMinutes: 20,
          createdAt: new Date(completedAt.getTime() - 3600000), dueAt: new Date(completedAt.getTime() + 3600000),
          generationNotes: 'Synthetic sample history for teacher dashboard testing. Not real student work.',
          questions: { create: template.questions.map(q => ({ schoolId: school.id, type: q.type, prompt: q.prompt, choicesJson: q.choicesJson, correctAnswer: q.correctAnswer, skillTag: q.skillTag, contextExcerpt: q.contextExcerpt, explanation: q.explanation, sortOrder: q.sortOrder })) }
        }, include: { questions: { orderBy: { sortOrder: 'asc' } } } });
        for (const student of classroom.students) {
          const score = scoreFor(student.displayName, index);
          await tx.studentSession.create({ data: {
            schoolId: school.id, studentId: student.id, materialId: material.id, status: 'COMPLETED',
            signInAt: new Date(completedAt.getTime() - (12 + index % 8) * 60000), completedAt, signedOutAt: completedAt, lastSeenAt: completedAt,
            pointsEarned: score, completedCharlotte: true,
            answers: { create: material.questions.map((q, qi) => {
              // Rotate which skills are missed rather than always missing the final questions.
              const correct = (qi + index) % 10 < score / 10;
              const wrong = JSON.parse(q.choicesJson).find(choice => choice !== q.correctAnswer);
              return { schoolId: school.id, questionId: q.id, answerText: correct ? q.correctAnswer : wrong, isCorrect: correct,
                attemptCount: 1, firstTryCorrect: correct, pointsEarned: correct ? 10 : 0, gradedAt: completedAt, createdAt: completedAt };
            }) }
          } });
        }
      }, { timeout: 30000 });
      created++;
    }
  }
  const where = { schoolId: school.id, id: { startsWith: prefix } };
  const materials = await prisma.material.count({ where });
  const sessions = await prisma.studentSession.count({ where: { material: where } });
  const answers = await prisma.studentAnswer.count({ where: { session: { material: where } } });
  if (materials !== 120 || sessions !== 480 || answers !== 4800) throw new Error('Demo history verification failed.');
  console.log(JSON.stringify({ created, reused, assignments: materials, completedResults: sessions, gradedAnswers: answers, studentsPerClass: 4 }));
} finally {
  await prisma.$disconnect();
}
