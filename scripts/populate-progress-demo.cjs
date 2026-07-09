const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const CLASS_CODE = "C14AI";
const TEST_EMAIL = "samuel.wright@example.com";

function choices(question) {
  try {
    return JSON.parse(question.choicesJson || "[]");
  } catch {
    return [];
  }
}

function pointsFor(index, count) {
  return Math.floor(100 / count) + (index < 100 % count ? 1 : 0);
}

async function main() {
  const classroom = await prisma.classroom.findUnique({
    where: { code: CLASS_CODE },
    include: {
      students: { where: { active: true }, orderBy: { displayName: "asc" } },
      materials: {
        where: { status: "PUBLISHED", activityKind: "IN_CLASS" },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { questions: { orderBy: { sortOrder: "asc" } } }
      }
    }
  });
  if (!classroom || !classroom.materials[0]) throw new Error("Demo class or published assignment not found.");

  const material = classroom.materials[0];
  const students = classroom.students.filter((student) => student.email !== TEST_EMAIL);
  const testStudent = classroom.students.find((student) => student.email === TEST_EMAIL);
  if (testStudent) {
    await prisma.studentSession.deleteMany({ where: { studentId: testStudent.id, materialId: material.id } });
  }
  const now = Date.now();

  for (let studentIndex = 0; studentIndex < students.length; studentIndex += 1) {
    const student = students[studentIndex];
    const scenario = studentIndex % 6;
    const completed = scenario === 0 || scenario === 1 || scenario === 5;
    const answerCount = completed ? material.questions.length : Math.max(1, material.questions.length - (scenario - 1));
    const signInAt = new Date(now - (12 + studentIndex * 2) * 60_000);
    const finishedAt = completed ? new Date(signInAt.getTime() + (9 + (studentIndex % 6)) * 60_000) : null;

    await prisma.studentSession.deleteMany({ where: { studentId: student.id, materialId: material.id } });

    const answerData = material.questions.slice(0, answerCount).map((question, questionIndex) => {
      const options = choices(question);
      const freeResponse = options.length === 0 || !question.correctAnswer;
      if (freeResponse) {
        const pending = scenario === 2 || scenario === 3 || studentIndex % 3 === 0;
        const correct = pending ? null : scenario !== 5 || questionIndex % 2 === 0;
        return {
          questionId: question.id,
          answerText: `I think the strongest evidence is in the character's choices because those details show how the situation changes and why the response makes sense.`,
          isCorrect: correct,
          attemptCount: 1,
          firstTryCorrect: correct,
          pointsEarned: correct ? pointsFor(questionIndex, material.questions.length) : 0
        };
      }

      const shouldBeCorrect = scenario === 0 || (questionIndex + studentIndex) % 4 !== 0;
      const retry = shouldBeCorrect && scenario !== 0 && (questionIndex + studentIndex) % 3 === 0;
      const wrongChoice = options.find((option) => option !== question.correctAnswer) || options[0];
      return {
        questionId: question.id,
        answerText: shouldBeCorrect ? question.correctAnswer : wrongChoice,
        isCorrect: shouldBeCorrect,
        attemptCount: shouldBeCorrect ? (retry ? 2 : 1) : 3,
        firstTryCorrect: shouldBeCorrect && !retry,
        pointsEarned: shouldBeCorrect && !retry ? pointsFor(questionIndex, material.questions.length) : 0,
        revealedAnswer: !shouldBeCorrect
      };
    });

    const totalPoints = answerData.reduce((sum, answer) => sum + answer.pointsEarned, 0);
    await prisma.studentSession.create({
      data: {
        studentId: student.id,
        materialId: material.id,
        signInAt,
        lastSeenAt: finishedAt || new Date(now - (studentIndex % 4) * 60_000),
        signedOutAt: finishedAt,
        completedAt: finishedAt,
        status: completed ? "COMPLETED" : scenario === 4 ? "PARTIAL" : "IN_PROGRESS",
        completedCharlotte: completed,
        pointsEarned: totalPoints,
        focusViolationCount: scenario === 4 ? 1 : 0,
        flaggedAt: scenario === 4 ? new Date(now - 3 * 60_000) : null,
        answers: { create: answerData }
      }
    });
  }

  const testSessions = testStudent
    ? await prisma.studentSession.count({ where: { studentId: testStudent.id, materialId: material.id } })
    : 0;
  console.log(`Populated ${students.length} students for "${material.title}". Test student sessions cleared: ${testSessions}.`);
}

main().finally(() => prisma.$disconnect());
