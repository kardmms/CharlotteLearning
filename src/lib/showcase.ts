import "server-only";

import crypto from "node:crypto";
import { ActivityKind, MaterialStatus, QuestionType } from "@prisma/client";
import { prisma } from "@/lib/db";
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
const SHOWCASE_TICK_CLAIM_MS = 8_000;
const SHOWCASE_RETRY_AFTER_ERROR_MS = 1_200;

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

type ShowcaseWrittenTask = {
  studentId: string;
  studentLabel: string;
  profile: "strong" | "on_level" | "developing" | "needs_support";
  questionId: string;
  prompt: string;
  rubric: string;
  contextExcerpt: string;
};

function stableNumber(value: string) {
  return Number.parseInt(crypto.createHash("sha256").update(value).digest("hex").slice(0, 8), 16);
}

function studentProfile(index: number): ShowcaseWrittenTask["profile"] {
  return (["on_level", "strong", "developing", "on_level", "needs_support", "strong"] as const)[index % 6];
}

function gradeNumber(gradeLevel: string) {
  const normalized = gradeLevel.trim().toUpperCase();
  if (normalized === "K" || normalized === "TK") return 0;
  const match = normalized.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : 5;
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeResponseKey(value: string) {
  return compactText(value).toLowerCase();
}

function truncateAtWord(value: string, maxLength: number) {
  const cleaned = compactText(value);
  if (cleaned.length <= maxLength) return cleaned;
  const truncated = cleaned.slice(0, maxLength).replace(/\s+\S*$/, "").trim();
  return truncated || cleaned.slice(0, maxLength).trim();
}

function evidencePieces(contextExcerpt: string) {
  const cleaned = compactText(contextExcerpt);
  if (!cleaned) return ["the reading gives a clue that supports the answer"];
  const pieces = cleaned
    .split(/[.!?]+/)
    .map((part) => truncateAtWord(part, 180))
    .filter((part) => part.length >= 18 && /[a-z]/i.test(part));
  return pieces.length ? pieces.slice(0, 10) : [truncateAtWord(cleaned, 180)];
}

function stablePick<T>(values: T[], seed: number, offset = 0) {
  return values[(seed + offset) % values.length];
}

function claimForPrompt(prompt: string, grade: number) {
  const normalized = prompt.toLowerCase();
  const earlyPrefix = grade <= 2 ? "the answer is" : "the answer is supported by the text";
  if (/\b(predict|next|happen)\b/.test(normalized)) {
    return grade <= 2
      ? "what happens next will match the clues"
      : "the next event should follow from the clues already in the text";
  }
  if (/\b(theme|lesson|message|moral)\b/.test(normalized)) {
    return grade <= 2
      ? "the lesson comes from what the characters do"
      : "the theme comes from the choices and consequences in the passage";
  }
  if (/\b(main idea|central idea|mostly about)\b/.test(normalized)) {
    return grade <= 2
      ? "the text is mostly about one important idea"
      : "the main idea is built from the repeated details in the passage";
  }
  if (/\b(character|speaker|narrator)\b/.test(normalized)) {
    return grade <= 2
      ? "the character shows feelings by what they do"
      : "the character's actions reveal what they are thinking and feeling";
  }
  if (/\b(compare|contrast|same|different)\b/.test(normalized)) {
    return grade <= 2
      ? "the two parts are alike and different in important ways"
      : "the comparison depends on looking at the details side by side";
  }
  if (/\b(why|reason|cause)\b/.test(normalized)) {
    return grade <= 2
      ? "there is a reason in the text"
      : "the reason is shown through the evidence in the passage";
  }
  if (/\b(how|explain|describe)\b/.test(normalized)) {
    return grade <= 2
      ? "the text shows how it happens"
      : "the explanation comes from the sequence of details in the text";
  }
  return earlyPrefix;
}

function reasoningForPrompt(prompt: string) {
  const normalized = prompt.toLowerCase();
  if (/\b(predict|next|happen)\b/.test(normalized)) return "it points to what will probably happen next";
  if (/\b(theme|lesson|message|moral)\b/.test(normalized)) return "it connects the event to a larger lesson";
  if (/\b(main idea|central idea|mostly about)\b/.test(normalized)) return "it repeats the central idea instead of a small side detail";
  if (/\b(character|speaker|narrator)\b/.test(normalized)) return "it shows the character through an action or choice";
  if (/\b(compare|contrast|same|different)\b/.test(normalized)) return "it gives a detail that can be compared with another part";
  if (/\b(why|reason|cause)\b/.test(normalized)) return "it explains why the event or idea happens";
  if (/\b(how|explain|describe)\b/.test(normalized)) return "it explains the process in order";
  return "it directly supports the answer";
}

function fallbackWrittenResponse(task: ShowcaseWrittenTask, gradeLevel: string, index: number) {
  const seed = stableNumber(`${task.studentId}:${task.questionId}:writing`);
  const grade = gradeNumber(gradeLevel);
  const early = grade <= 2;
  const openers = early ? [
    "I think", "My answer is", "I noticed", "One clue shows", "The text shows", "I predict"
  ] : [
    "I think", "My answer is", "The passage suggests", "The strongest answer is",
    "I would explain that", "The text makes me think", "A careful answer is", "My evidence shows"
  ];
  const evidenceOpeners = [
    "One detail is", "For example", "A useful clue is", "The clearest evidence is",
    "This is supported when", "The text explains", "I used the part where", "A moment that shows this is"
  ];
  const developingClosers = [
    "That clue helped me answer.", "This made my answer make sense.", "I might need one more detail too.",
    "That is why I chose that answer.", "I checked that part again.", "This is the part I understood best."
  ];
  const onLevelClosers = [
    "That detail connects back to the question.", "It supports my answer directly.",
    "It helped me explain my thinking.", "That part gives evidence instead of just a guess.",
    "It shows the answer in the text.", "That clue makes the answer stronger."
  ];
  const strongClosers = [
    "This makes the answer stronger because", "That evidence matters because",
    "I would use that detail because", "This connects to the question because",
    "The detail is important because", "It supports the answer because"
  ];
  const pieces = evidencePieces(task.contextExcerpt);
  const evidence = truncateAtWord(
    stablePick(pieces, seed, index),
    early ? 90 : 145
  );
  const secondEvidence = truncateAtWord(
    stablePick(pieces, Math.floor(seed / Math.max(1, pieces.length)), index + 3),
    early ? 80 : 125
  );
  const opener = stablePick(openers, seed, index);
  const evidenceOpener = stablePick(evidenceOpeners, Math.floor(seed / openers.length), index);
  const claim = claimForPrompt(task.prompt, grade);
  const reasoning = reasoningForPrompt(`${task.prompt} ${task.rubric}`);

  if (early) {
    if (task.profile === "needs_support") {
      return `${opener} ${claim}. ${evidenceOpener} ${evidence}.`;
    }
    if (task.profile === "developing") {
      return `${opener} ${claim}. ${evidenceOpener} ${evidence}. ${stablePick(developingClosers, seed, index)}`;
    }
    return `${opener} ${claim}. ${evidenceOpener} ${evidence}. ${stablePick(onLevelClosers, seed, index)}`;
  }

  if (task.profile === "needs_support") {
    return `${opener} ${claim}. ${evidenceOpener} ${evidence}.`;
  }
  if (task.profile === "developing") {
    return `${opener} ${claim}. ${evidenceOpener} ${evidence}. ${stablePick(developingClosers, seed, index)}`;
  }
  if (task.profile === "strong") {
    return `${opener} ${claim}. ${evidenceOpener} ${evidence}. ${stablePick(strongClosers, seed, index)} ${reasoning}.`;
  }
  return `${opener} ${claim}. ${evidenceOpener} ${evidence}. ${stablePick(onLevelClosers, seed, index)} ${secondEvidence !== evidence ? `I also noticed ${secondEvidence}.` : ""}`.trim();
}

function generateWrittenResponses(
  tasks: ShowcaseWrittenTask[],
  gradeLevel: string,
  existingAnswerTexts: string[] = []
) {
  const usedResponses = new Set(existingAnswerTexts.map(normalizeResponseKey));
  const distinctTails = [
    "That clue stood out to me most.",
    "I would underline that part first.",
    "This helped me check my answer.",
    "I used that detail before adding anything else.",
    "That part made my thinking clearer.",
    "I would go back to that sentence when explaining.",
    "This was the evidence I trusted most.",
    "That clue helped me avoid guessing.",
    "I noticed that detail before the ending.",
    "This part connects best to the prompt.",
    "I would use this as my first evidence note.",
    "That is the detail I would share with a partner."
  ];
  const fallback = new Map<string, string>();

  tasks.forEach((task, index) => {
    const baseResponse = fallbackWrittenResponse(task, gradeLevel, index);
    let response = baseResponse;
    let attempt = 0;

    while (usedResponses.has(normalizeResponseKey(response)) && attempt < distinctTails.length) {
      const seed = stableNumber(`${task.studentId}:${task.questionId}:distinct:${attempt}`);
      response = `${baseResponse} ${stablePick(distinctTails, seed, index + attempt)}`;
      attempt += 1;
    }

    // This final fallback keeps uniqueness guaranteed even for unusually large demo rosters.
    if (usedResponses.has(normalizeResponseKey(response))) {
      response = `${baseResponse} My extra note is that clue ${index + 1} helped me decide.`;
    }

    const finalResponse = truncateAtWord(response, 800);
    usedResponses.add(normalizeResponseKey(finalResponse));
    fallback.set(`${task.studentId}:${task.questionId}`, finalResponse);
  });
  return { responses: fallback, usedOpenAI: false };
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
    // Keep one tab at a time advancing the demo, but recover quickly if a
    // local tick is interrupted.
    data: {
      showcaseNextTickAt: new Date(now.getTime() + SHOWCASE_TICK_CLAIM_MS),
      showcaseCleanupAt: null
    }
  });
  if (claimed.count !== 1) {
    return getShowcaseSimulationStatus(teacherId);
  }

  try {
  const materials = await prisma.material.findMany({
    where: {
      teacherId,
      status: MaterialStatus.PUBLISHED,
      activityKind: ActivityKind.IN_CLASS,
      isAdaptiveHome: false,
      showcaseSimulationStartedAt: { not: null },
      showcaseSimulationCompletedAt: null,
      classroom: {
        archivedAt: null
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
  const candidates = activeSessions.flatMap((session) => {
    const answeredIds = new Set(session.answers.map((answer) => answer.questionId));
    return material.questions
      .filter((question) => !answeredIds.has(question.id))
      .map((question) => ({ session, question }));
  });

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
    material.questions
      .filter((question) => parseChoices(question.choicesJson).length === 0)
      .map((question) => question.id)
  );
  const existingWrittenAnswers = currentSessions
    .flatMap((session) => session.answers)
    .filter((answer) => writtenQuestionIds.has(answer.questionId))
    .map((answer) => answer.answerText);
  const generated = generateWrittenResponses(
    writtenTasks,
    material.gradeLevel || material.classroom.gradeLevel,
    existingWrittenAnswers
  );

  const sessionAdvances = new Map<string, {
    session: (typeof candidates)[number]["session"];
    questions: Array<(typeof candidates)[number]["question"]>;
    pointsEarned: number;
  }>();
  const answersToCreate = candidates.map(({ session, question }) => {
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
    const advance = sessionAdvances.get(session.id) || { session, questions: [], pointsEarned: 0 };
    advance.questions.push(question);
    advance.pointsEarned += pointsEarned;
    sessionAdvances.set(session.id, advance);
    return {
      sessionId: session.id,
      questionId: question.id,
      answerText,
      isCorrect,
      attemptCount,
      firstTryCorrect: isCorrect === true && attemptCount === 1,
      pointsEarned,
      revealedAnswer: isMultipleChoice && isCorrect === false && profile === "needs_support"
    };
  });

  await prisma.$transaction(async (transaction) => {
    if (answersToCreate.length > 0) {
      await transaction.studentAnswer.createMany({ data: answersToCreate });
    }
    for (const { session, questions, pointsEarned } of sessionAdvances.values()) {
      const answerCount = session.answers.length + questions.length;
      const isComplete = answerCount >= material.questions.length;
      const addFocusAlert = session.focusViolationCount === 0 && answerCount >= 3 && stableNumber(session.studentId) % 9 === 0;
      await transaction.studentSession.update({
        where: { id: session.id },
        data: {
          lastSeenAt: now,
          foundChapter: true,
          heardVocabulary: session.heardVocabulary || questions.some((question) => question.type === QuestionType.VOCAB) || answerCount >= 2,
          answeredPrompt: true,
          madePrediction: session.madePrediction || questions.some((question) => question.type === QuestionType.PREDICTION),
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
  } catch (error) {
    await scheduleNextShowcaseTick(teacherId, SHOWCASE_RETRY_AFTER_ERROR_MS).catch(() => undefined);
    throw error;
  }
}
