import "server-only";

import crypto from "node:crypto";
import { ActivityKind, IdentityMode, MaterialStatus, QuestionType } from "@prisma/client";
import OpenAI from "openai";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { restrictedFetch } from "@/lib/outbound";
import { SHOWCASE_LIFETIME_MS } from "@/lib/showcase-policy";

export const SHOWCASE_STUDENT_NAMES = [
  "Avery M.",
  "Jordan K.",
  "Sofia R.",
  "Liam T.",
  "Maya P.",
  "Noah B.",
  "Chloe S.",
  "Mateo D.",
  "Emma J.",
  "Lucas W.",
  "Zoe C.",
  "Elijah H."
];

const showcaseStudentEmailDomain = "@demo.charlottelearning.ai";

async function deleteOrphanedShowcaseStudentAccounts() {
  return prisma.studentAccount.deleteMany({
    where: {
      email: { startsWith: "student-", endsWith: showcaseStudentEmailDomain },
      enrollments: { none: {} }
    }
  });
}

export async function deleteShowcaseWorkspace(teacherId: string) {
  const workspace = await prisma.teacher.findFirst({
    where: { id: teacherId, isShowcase: true },
    select: {
      id: true,
      classrooms: {
        select: {
          id: true,
          students: { select: { id: true, accountId: true } },
          materials: { select: { id: true } }
        }
      }
    }
  });
  if (!workspace) {
    await deleteOrphanedShowcaseStudentAccounts();
    return { count: 0 };
  }

  const studentAccountIds = workspace.classrooms.flatMap((classroom) => (
    classroom.students.flatMap((student) => student.accountId ? [student.accountId] : [])
  ));
  const targetIds = [
    workspace.id,
    ...workspace.classrooms.map((classroom) => classroom.id),
    ...workspace.classrooms.flatMap((classroom) => classroom.students.map((student) => student.id)),
    ...workspace.classrooms.flatMap((classroom) => classroom.materials.map((material) => material.id))
  ];
  const deletionResults = await prisma.$transaction([
    prisma.auditEvent.deleteMany({
      where: {
        OR: [
          { actorId: workspace.id },
          { targetId: { in: targetIds } }
        ]
      }
    }),
    prisma.studentAccount.deleteMany({ where: { id: { in: studentAccountIds } } }),
    prisma.teacher.deleteMany({ where: { id: workspace.id, isShowcase: true } })
  ]);
  await deleteOrphanedShowcaseStudentAccounts();
  return deletionResults[2];
}

export async function removeExpiredShowcaseWorkspaces(now = new Date()) {
  const expired = await prisma.teacher.findMany({
    where: {
      isShowcase: true,
      OR: [
        { createdAt: { lte: new Date(now.getTime() - SHOWCASE_LIFETIME_MS) } },
        { showcaseExpiresAt: { lt: now } },
        { showcaseCleanupAt: { lte: now } }
      ]
    },
    select: { id: true }
  });
  let count = 0;
  for (const teacher of expired) {
    count += (await deleteShowcaseWorkspace(teacher.id)).count;
  }
  await deleteOrphanedShowcaseStudentAccounts();
  return { count };
}

export async function scheduleShowcaseCleanup(teacherId: string) {
  return prisma.teacher.updateMany({
    where: { id: teacherId, isShowcase: true },
    data: { showcaseCleanupAt: new Date(Date.now() + 2 * 60 * 1000) }
  });
}

export async function createShowcaseWorkspace(passwordHash: string) {
  const now = new Date();
  await removeExpiredShowcaseWorkspaces(now).catch(() => undefined);

  const teacher = await prisma.teacher.create({
    data: {
      name: "Showcase Teacher",
      email: `showcase-${crypto.randomUUID()}@demo.charlottelearning.ai`,
      passwordHash,
      weeklySummaryEnabled: false,
      isShowcase: true,
      showcaseExpiresAt: new Date(now.getTime() + SHOWCASE_LIFETIME_MS)
    }
  });
  return { teacher };
}

const ShowcaseResponseSchema = z.object({
  responses: z.array(z.object({
    studentId: z.string().min(1).max(80),
    answerText: z.string().trim().min(2).max(800)
  })).max(30)
});

type ShowcaseWrittenTask = {
  studentId: string;
  studentLabel: string;
  profile: "strong" | "on_level" | "developing" | "needs_support";
  questionId: string;
  prompt: string;
  rubric: string;
  contextExcerpt: string;
};

function openAiApiKey() {
  return process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY || "";
}

function stableNumber(value: string) {
  return Number.parseInt(crypto.createHash("sha256").update(value).digest("hex").slice(0, 8), 16);
}

function studentProfile(index: number): ShowcaseWrittenTask["profile"] {
  return (["on_level", "strong", "developing", "on_level", "needs_support", "strong"] as const)[index % 6];
}

function gradeWritingGuidance(gradeLevel: string) {
  const grade = gradeLevel.toUpperCase() === "K" ? 0 : Number.parseInt(gradeLevel, 10);
  if (!Number.isFinite(grade)) return "Use clear student language and a short classroom response.";
  if (grade <= 2) return "Use 1 short sentence, familiar words, and early-elementary spelling and grammar.";
  if (grade <= 5) return "Use 1-3 short sentences with elementary vocabulary and concrete text evidence.";
  if (grade <= 8) return "Use 2-4 concise sentences with middle-school vocabulary and relevant evidence.";
  return "Use 2-5 concise sentences with high-school vocabulary, interpretation, and relevant evidence.";
}

function fallbackWrittenResponse(task: ShowcaseWrittenTask, gradeLevel: string, index: number) {
  const seed = stableNumber(`${task.studentId}:${task.questionId}:writing`);
  const elementaryOpeners = [
    "I think", "My answer is", "One clue is", "The story shows", "I noticed", "This means",
    "A detail is", "Mara learns", "The group learns", "It seems", "I predict", "The lesson is"
  ];
  const evidenceOpeners = [
    "For example", "One detail is", "The clearest evidence is", "This is supported when",
    "The text explains that", "A moment that shows this is", "We can see this when", "The story says"
  ];
  const elementaryOpener = elementaryOpeners[seed % elementaryOpeners.length];
  const evidenceOpener = evidenceOpeners[Math.floor(seed / elementaryOpeners.length) % evidenceOpeners.length];
  const evidence = task.contextExcerpt
    .replace(/\s+/g, " ")
    .split(/[.!?]/)
    .map((part) => part.trim())
    .find(Boolean)
    ?.slice(0, 140);
  const grade = gradeLevel.toUpperCase() === "K" ? 0 : Number.parseInt(gradeLevel, 10);
  const shortEvidence = evidence || "the characters solve one part at a time";
  if (Number.isFinite(grade) && grade <= 2) {
    return index % 2 === 0
      ? `${elementaryOpener} they will get ready and help each other.`
      : `${elementaryOpener} the big job got easier when friends helped.`;
  }
  if (task.profile === "needs_support") {
    return index % 2 === 0
      ? `${elementaryOpener} they will be ready because they made a plan for next time.`
      : `${elementaryOpener} people can help with a big problem. They each did a small part.`;
  }
  if (task.profile === "developing") {
    return `The group will probably work together again. ${evidenceOpener} ${shortEvidence.toLowerCase()}.`;
  }
  if (task.profile === "strong") {
    return `Mara learns that planning and teamwork can make a difficult problem manageable. ${evidenceOpener} ${shortEvidence.toLowerCase()}.`;
  }
  return index % 2 === 0
    ? `They will probably follow their storm plan and divide the work. ${evidenceOpener} ${shortEvidence.toLowerCase()}.`
    : `The lesson is that a large problem becomes easier when people plan and cooperate. ${evidenceOpener} ${shortEvidence.toLowerCase()}.`;
}

async function generateWrittenResponses(
  tasks: ShowcaseWrittenTask[],
  gradeLevel: string,
  existingAnswerTexts: string[]
) {
  const fallback = new Map(tasks.map((task, index) => [
    `${task.studentId}:${task.questionId}`,
    fallbackWrittenResponse(task, gradeLevel, index)
  ]));
  const apiKey = openAiApiKey();
  if (!apiKey || tasks.length === 0) return { responses: fallback, usedOpenAI: false };

  try {
    const openai = new OpenAI({ apiKey, fetch: restrictedFetch, timeout: 15_000, maxRetries: 1 });
    const model = process.env.SHOWCASE_OPENAI_MODEL || "gpt-5.6-terra";
    const completion = await openai.chat.completions.create({
      model,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "showcase_student_responses",
          strict: true,
          schema: {
            type: "object",
            properties: {
              responses: {
                type: "array",
                maxItems: 30,
                items: {
                  type: "object",
                  properties: {
                    studentId: { type: "string" },
                    answerText: { type: "string" }
                  },
                  required: ["studentId", "answerText"],
                  additionalProperties: false
                }
              }
            },
            required: ["responses"],
            additionalProperties: false
          }
        }
      },
      messages: [
        {
          role: "system",
          content: [
            "Generate fictional student work for a classroom product showcase.",
            "Return valid JSON only. Never include personal information or mention that the answer is simulated.",
            "Make every response meaningfully different in wording, evidence, detail, and occasional age-realistic mistakes.",
            "A strong response should be accurate and well supported. An on_level response should be correct and direct.",
            "A developing response may be partly supported or imprecise. A needs_support response may be brief or show a plausible misconception.",
            "Do not label proficiency in the response and do not make mistakes cartoonish."
          ].join(" ")
        },
        {
          role: "user",
          content: [
            `The class grade is ${gradeLevel}. ${gradeWritingGuidance(gradeLevel)}`,
            "Create one answer for every task. Preserve each studentId exactly.",
            'Return exactly: {"responses":[{"studentId":"...","answerText":"..."}]}.',
            `Tasks: ${JSON.stringify(tasks.map((task) => ({
              studentId: task.studentId,
              studentLabel: task.studentLabel,
              profile: task.profile,
              question: task.prompt,
              rubric: task.rubric,
              readingContext: task.contextExcerpt
            })))} `
          ].join("\n")
        }
      ]
    });
    const raw = completion.choices[0]?.message.content;
    if (!raw) return { responses: fallback, usedOpenAI: false };
    const parsed = ShowcaseResponseSchema.parse(JSON.parse(raw));
    const seen = new Set(existingAnswerTexts.map((answer) => answer.replace(/\s+/g, " ").trim().toLowerCase()));
    let acceptedResponses = 0;
    for (const item of parsed.responses) {
      const task = tasks.find((candidate) => candidate.studentId === item.studentId);
      if (!task) continue;
      const normalized = item.answerText.replace(/\s+/g, " ").trim().slice(0, 800);
      const duplicateKey = normalized.toLowerCase();
      if (!normalized || seen.has(duplicateKey)) continue;
      seen.add(duplicateKey);
      fallback.set(`${task.studentId}:${task.questionId}`, normalized);
      acceptedResponses += 1;
    }
    return { responses: fallback, usedOpenAI: acceptedResponses > 0 };
  } catch (error) {
    console.error("Showcase response generation fell back to local samples", error);
    return { responses: fallback, usedOpenAI: false };
  }
}

function parseChoices(choicesJson: string | null) {
  if (!choicesJson) return [];
  try {
    const values = JSON.parse(choicesJson) as unknown;
    return Array.isArray(values) ? values.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function questionPointValue(sortOrder: number, questionCount: number) {
  const base = Math.floor(100 / Math.max(1, questionCount));
  return base + (sortOrder <= 100 % Math.max(1, questionCount) ? 1 : 0);
}

async function scheduleNextShowcaseTick(teacherId: string, delayMs = 4_000) {
  await prisma.teacher.updateMany({
    where: { id: teacherId, isShowcase: true },
    data: { showcaseNextTickAt: new Date(Date.now() + delayMs) }
  });
}

export async function startShowcaseMaterialSimulation(
  teacherId: string,
  classroomId: string,
  materialId: string
) {
  const material = await prisma.material.findFirst({
    where: {
      id: materialId,
      classroomId,
      teacherId,
      isAdaptiveHome: false,
      teacher: { isShowcase: true }
    },
    include: {
      _count: { select: { questions: true } },
      classroom: { select: { _count: { select: { students: { where: { active: true } } } } } }
    }
  });
  if (!material) throw new Error("Showcase assignment not found.");
  if (material._count.questions === 0) throw new Error("Add at least one question before starting the simulation.");
  if (material.classroom._count.students === 0) throw new Error("Add students before starting the simulation.");

  const now = new Date();
  await prisma.$transaction([
    prisma.studentSession.deleteMany({ where: { materialId } }),
    prisma.material.updateMany({
      where: {
        teacherId,
        id: { not: materialId },
        showcaseSimulationStartedAt: { not: null },
        showcaseSimulationCompletedAt: null
      },
      data: { showcaseSimulationCompletedAt: now }
    }),
    prisma.material.update({
      where: { id: materialId },
      data: {
        status: MaterialStatus.PUBLISHED,
        showcaseSimulationStartedAt: now,
        showcaseSimulationCompletedAt: null
      }
    }),
    prisma.teacher.update({
      where: { id: teacherId },
      data: { showcaseNextTickAt: null, showcaseCleanupAt: null }
    })
  ]);
}

export async function getShowcaseSimulationStatus(teacherId: string) {
  const material = await prisma.material.findFirst({
    where: {
      teacherId,
      showcaseSimulationStartedAt: { not: null },
      showcaseSimulationCompletedAt: null
    },
    orderBy: { showcaseSimulationStartedAt: "desc" },
    select: {
      id: true,
      classroomId: true,
      title: true,
      classroom: { select: { _count: { select: { students: { where: { active: true } } } } } },
      sessions: {
        where: { status: "COMPLETED" },
        select: { id: true }
      }
    }
  });
  if (!material) return { running: false as const, advanced: false };
  return {
    running: true as const,
    advanced: false,
    materialId: material.id,
    classroomId: material.classroomId,
    title: material.title,
    totalStudents: material.classroom._count.students,
    completedStudents: material.sessions.length
  };
}

export async function runShowcaseTick(teacherId: string) {
  const now = new Date();
  const claimed = await prisma.teacher.updateMany({
    where: {
      id: teacherId,
      isShowcase: true,
      createdAt: { gt: new Date(now.getTime() - SHOWCASE_LIFETIME_MS) },
      showcaseExpiresAt: { gt: now },
      OR: [
        { showcaseNextTickAt: null },
        { showcaseNextTickAt: { lte: now } }
      ]
    },
    // Hold the claim longer than the OpenAI timeout so two open tabs cannot
    // generate or write the same student's next response concurrently.
    data: {
      showcaseNextTickAt: new Date(now.getTime() + 45_000),
      showcaseCleanupAt: null
    }
  });
  if (claimed.count !== 1) {
    return getShowcaseSimulationStatus(teacherId);
  }

  const materials = await prisma.material.findMany({
    where: {
      teacherId,
      status: MaterialStatus.PUBLISHED,
      activityKind: ActivityKind.IN_CLASS,
      isAdaptiveHome: false,
      showcaseSimulationStartedAt: { not: null },
      showcaseSimulationCompletedAt: null,
      classroom: {
        archivedAt: null,
        identityMode: IdentityMode.STANDARD
      },
      questions: { some: {} }
    },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      classroom: {
        include: {
          students: {
            where: { active: true },
            orderBy: { createdAt: "asc" }
          }
        }
      },
      questions: { orderBy: { sortOrder: "asc" } },
      sessions: {
        orderBy: { signInAt: "asc" },
        include: { answers: true, student: true }
      }
    }
  });

  const material = materials[0];
  if (!material) {
    await scheduleNextShowcaseTick(teacherId);
    return { running: false as const, advanced: false };
  }

  const startedStudentIds = new Set(material.sessions.map((session) => session.studentId));
  const studentsToStart = material.classroom.students
    .filter((student) => !startedStudentIds.has(student.id));
  if (studentsToStart.length > 0) {
    await prisma.studentSession.createMany({
      data: studentsToStart.map((student, index) => ({
        studentId: student.id,
        materialId: material.id,
        signInAt: new Date(now.getTime() + index * 250),
        lastSeenAt: now,
        openedBook: true
      }))
    });
  }

  const currentSessions = await prisma.studentSession.findMany({
    where: { materialId: material.id },
    orderBy: { signInAt: "asc" },
    include: { answers: true, student: true }
  });
  const activeSessions = currentSessions.filter((session) => session.status === "IN_PROGRESS");
  const candidates = activeSessions.map((session) => {
    const answeredIds = new Set(session.answers.map((answer) => answer.questionId));
    const question = material.questions.find((item) => !answeredIds.has(item.id));
    return question ? { session, question } : null;
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));

  const writtenTasks = candidates.flatMap(({ session, question }) => {
    if (parseChoices(question.choicesJson).length > 0) return [];
    const studentIndex = material.classroom.students.findIndex((student) => student.id === session.studentId);
    return [{
      studentId: session.studentId,
      studentLabel: `Student ${Math.max(1, studentIndex + 1)}`,
      profile: studentProfile(Math.max(0, studentIndex)),
      questionId: question.id,
      prompt: question.prompt,
      rubric: question.rubric || "Answer the question and support the idea with a relevant detail.",
      contextExcerpt: question.contextExcerpt || material.sourcePreview || material.sourceText?.slice(0, 800) || ""
    } satisfies ShowcaseWrittenTask];
  });
  const writtenQuestionIds = new Set(
    material.questions.filter((question) => parseChoices(question.choicesJson).length === 0).map((question) => question.id)
  );
  const existingWrittenAnswers = currentSessions.flatMap((session) => session.answers)
    .filter((answer) => writtenQuestionIds.has(answer.questionId))
    .map((answer) => answer.answerText);
  const generated = await generateWrittenResponses(
    writtenTasks,
    material.gradeLevel || material.classroom.gradeLevel,
    existingWrittenAnswers
  );

  await prisma.$transaction(async (transaction) => {
    for (const { session, question } of candidates) {
      const choices = parseChoices(question.choicesJson);
      const studentIndex = Math.max(0, material.classroom.students.findIndex((student) => student.id === session.studentId));
      const profile = studentProfile(studentIndex);
      const roll = stableNumber(`${session.studentId}:${question.id}`) % 100;
      const correctChance = profile === "strong" ? 90 : profile === "on_level" ? 76 : profile === "developing" ? 58 : 38;
      const isMultipleChoice = choices.length > 0 && Boolean(question.correctAnswer);
      const isCorrect = isMultipleChoice ? roll < correctChance : null;
      const wrongChoices = choices.filter((choice) => choice !== question.correctAnswer);
      const answerText = isMultipleChoice
        ? isCorrect
          ? question.correctAnswer as string
          : wrongChoices[stableNumber(`${question.id}:${session.studentId}:wrong`) % Math.max(1, wrongChoices.length)] || choices[0]
        : generated.responses.get(`${session.studentId}:${question.id}`) || "I used a detail from the reading to explain my thinking.";
      const attemptCount = isMultipleChoice && isCorrect === false && profile !== "needs_support" ? 2 : 1;
      const pointsEarned = isCorrect === true && attemptCount === 1
        ? questionPointValue(question.sortOrder, material.questions.length)
        : 0;
      await transaction.studentAnswer.create({
        data: {
          sessionId: session.id,
          questionId: question.id,
          answerText,
          isCorrect,
          attemptCount,
          firstTryCorrect: isCorrect === true && attemptCount === 1,
          pointsEarned,
          revealedAnswer: isMultipleChoice && isCorrect === false && profile === "needs_support"
        }
      });

      const answerCount = session.answers.length + 1;
      const isComplete = answerCount >= material.questions.length;
      const addFocusAlert = session.focusViolationCount === 0 && answerCount >= 3 && stableNumber(session.studentId) % 9 === 0;
      await transaction.studentSession.update({
        where: { id: session.id },
        data: {
          lastSeenAt: now,
          foundChapter: true,
          heardVocabulary: session.heardVocabulary || question.type === QuestionType.VOCAB || answerCount >= 2,
          answeredPrompt: true,
          madePrediction: session.madePrediction || question.type === QuestionType.PREDICTION,
          understoodStory: session.understoodStory || answerCount >= Math.ceil(material.questions.length / 2),
          pointsEarned: session.pointsEarned + pointsEarned,
          ...(addFocusAlert ? { focusViolationCount: 1, flaggedAt: now } : {}),
          ...(isComplete ? {
            status: "COMPLETED",
            completedCharlotte: true,
            completedAt: now,
            signedOutAt: now
          } : {})
        }
      });
    }
  });

  const completedStudents = await prisma.studentSession.count({
    where: { materialId: material.id, status: "COMPLETED" }
  });
  const totalStudents = material.classroom.students.length;
  const simulationCompleted = totalStudents > 0 && completedStudents >= totalStudents;
  if (simulationCompleted) {
    await prisma.material.update({
      where: { id: material.id },
      data: { showcaseSimulationCompletedAt: new Date() }
    });
  }
  await scheduleNextShowcaseTick(teacherId, simulationCompleted ? 5_000 : 1_200);

  return {
    running: !simulationCompleted,
    simulationCompleted,
    advanced: studentsToStart.length > 0 || candidates.length > 0,
    title: material.title,
    materialId: material.id,
    classroomId: material.classroomId,
    started: studentsToStart.length,
    answered: candidates.length,
    totalStudents,
    completedStudents,
    usedOpenAI: generated.usedOpenAI
  };
}
