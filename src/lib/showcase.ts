import "server-only";

import crypto from "node:crypto";
import { ActivityKind, IdentityMode, MaterialStatus, QuestionType } from "@prisma/client";
import OpenAI from "openai";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { restrictedFetch } from "@/lib/outbound";

const showcaseLifetimeMs = 2 * 60 * 60 * 1000;

const studentNames = [
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

const sourceText = [
  "Mara noticed the community garden gate swinging in the wind. The storm had scattered seed packets across the path, and the smallest tomato plants leaned toward the ground.",
  "She wanted to fix everything before the neighborhood meeting, but the job was too large for one person. Mara made a list, asked Mr. Chen for spare stakes, and invited two friends to help after school.",
  "At first, Theo rushed and tied the stems too tightly. Mara showed him how to leave room for each plant to grow. By sunset, the paths were clear, the plants stood upright, and the seed packets were sorted into a dry box.",
  "At the meeting, Mara did not claim the success for herself. She explained how every person had solved one small part of the problem. The neighbors decided to create a storm plan so the garden would be ready next time."
].join("\n\n");

const demoQuestions = [
  {
    type: QuestionType.VOCAB,
    prompt: "What does scattered mean in the first paragraph?",
    choices: ["Spread in different places", "Planted in straight rows", "Locked inside a box", "Covered with water"],
    correctAnswer: "Spread in different places",
    explanation: "The seed packets were spread across the path after the storm.",
    skillTag: "Vocabulary in context",
    standardCode: "RL.5.4",
    contextExcerpt: "The storm had scattered seed packets across the path, and the smallest tomato plants leaned toward the ground."
  },
  {
    type: QuestionType.COMPREHENSION,
    prompt: "Why does Mara make a list?",
    choices: ["To divide a large job into smaller tasks", "To remember what seeds to buy", "To cancel the neighborhood meeting", "To prove that Theo made a mistake"],
    correctAnswer: "To divide a large job into smaller tasks",
    explanation: "Mara realizes she needs a plan and help from other people.",
    skillTag: "Character response",
    standardCode: "RL.5.2",
    contextExcerpt: "She wanted to fix everything before the neighborhood meeting, but the job was too large for one person. Mara made a list."
  },
  {
    type: QuestionType.COMPREHENSION,
    prompt: "What problem does Mara help Theo solve?",
    choices: ["He ties the plant stems too tightly", "He loses the garden key", "He plants tomatoes in the path", "He arrives after the meeting"],
    correctAnswer: "He ties the plant stems too tightly",
    explanation: "Mara teaches Theo to leave space for the plants to grow.",
    skillTag: "Key details",
    standardCode: "RL.5.1",
    contextExcerpt: "At first, Theo rushed and tied the stems too tightly. Mara showed him how to leave room for each plant to grow."
  },
  {
    type: QuestionType.VOCAB,
    prompt: "What does claim mean when Mara does not claim the success?",
    choices: ["Say the success belonged only to her", "Ask the group to begin again", "Write the plan on paper", "Repair the broken gate"],
    correctAnswer: "Say the success belonged only to her",
    explanation: "Mara gives credit to everyone instead of taking all the credit herself.",
    skillTag: "Vocabulary in context",
    standardCode: "RL.5.4",
    contextExcerpt: "At the meeting, Mara did not claim the success for herself. She explained how every person had solved one small part of the problem."
  },
  {
    type: QuestionType.COMPREHENSION,
    prompt: "Which event best shows that the group learned from the storm?",
    choices: ["They create a plan for future storms", "They sort the seed packets", "Mara notices the open gate", "Theo works after school"],
    correctAnswer: "They create a plan for future storms",
    explanation: "The new storm plan applies what they learned to a future problem.",
    skillTag: "Theme and evidence",
    standardCode: "RL.5.2",
    contextExcerpt: "The neighbors decided to create a storm plan so the garden would be ready next time."
  },
  {
    type: QuestionType.COMPREHENSION,
    prompt: "How does Mara affect the other characters?",
    choices: ["She helps them work together carefully", "She convinces them to leave the garden", "She makes them compete for credit", "She asks them to replace every plant"],
    correctAnswer: "She helps them work together carefully",
    explanation: "Mara organizes the work and teaches Theo how to protect the plants.",
    skillTag: "Character interactions",
    standardCode: "RL.5.3",
    contextExcerpt: "Mara made a list, asked Mr. Chen for spare stakes, and invited two friends to help after school."
  },
  {
    type: QuestionType.PREDICTION,
    prompt: "How will the neighbors probably respond to the next storm? Use one detail from the story.",
    rubric: "The response predicts that the neighbors will prepare or work together and supports the idea with a relevant story detail.",
    skillTag: "Prediction with evidence",
    standardCode: "RL.5.1",
    contextExcerpt: "The neighbors decided to create a storm plan so the garden would be ready next time."
  },
  {
    type: QuestionType.SHORT_RESPONSE,
    prompt: "What lesson does Mara learn about solving a large problem? Support your answer with evidence.",
    rubric: "The response states that large problems are easier to solve through planning and teamwork, then cites at least one relevant event.",
    skillTag: "Theme and evidence",
    standardCode: "RL.5.2",
    contextExcerpt: "She explained how every person had solved one small part of the problem."
  }
];

export async function removeExpiredShowcaseWorkspaces(now = new Date()) {
  return prisma.teacher.deleteMany({
    where: {
      isShowcase: true,
      showcaseExpiresAt: { lt: now }
    }
  });
}

export async function createShowcaseWorkspace(passwordHash: string) {
  const now = new Date();
  await removeExpiredShowcaseWorkspaces(now).catch(() => undefined);

  return prisma.$transaction(async (transaction) => {
    const teacher = await transaction.teacher.create({
      data: {
        name: "Showcase Teacher",
        email: `showcase-${crypto.randomUUID()}@demo.charlottelearning.ai`,
        passwordHash,
        weeklySummaryEnabled: false,
        isShowcase: true,
        showcaseExpiresAt: new Date(now.getTime() + showcaseLifetimeMs)
      }
    });
    const classroom = await transaction.classroom.create({
      data: {
        name: "Grade 5 Reading Workshop",
        gradeLevel: "5",
        teacherId: teacher.id,
        identityMode: IdentityMode.STANDARD,
        students: {
          create: studentNames.map((displayName) => ({ displayName }))
        }
      }
    });
    const material = await transaction.material.create({
      data: {
        teacherId: teacher.id,
        classroomId: classroom.id,
        title: "The Community Garden",
        sourceName: "showcase-reading.txt",
        sourcePreview: sourceText.slice(0, 900),
        sourceText,
        gradeLevel: classroom.gradeLevel,
        estimatedMinutes: 15,
        activityKind: ActivityKind.IN_CLASS,
        availableAt: now,
        dueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        status: MaterialStatus.PUBLISHED,
        generationNotes: "Showcase activity using fictional students and an original reading passage.",
        questions: {
          create: demoQuestions.map((question, index) => ({
            type: question.type,
            prompt: question.prompt,
            choicesJson: "choices" in question ? JSON.stringify(question.choices) : null,
            correctAnswer: "correctAnswer" in question ? question.correctAnswer : null,
            rubric: "rubric" in question ? question.rubric : null,
            explanation: "explanation" in question ? question.explanation : null,
            skillTag: question.skillTag,
            standardCode: question.standardCode,
            contextExcerpt: question.contextExcerpt,
            sourcePage: "Showcase passage",
            difficulty: index < 2 ? 2 : index < 6 ? 3 : 4,
            sortOrder: index + 1
          }))
        }
      }
    });

    return { teacher, classroomId: classroom.id, materialId: material.id };
  });
}

const ShowcaseResponseSchema = z.object({
  responses: z.array(z.object({
    studentId: z.string().min(1).max(80),
    answerText: z.string().trim().min(2).max(800)
  })).max(6)
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
      ? "They will get ready and help each other."
      : "The big job got easier when friends helped.";
  }
  if (task.profile === "needs_support") {
    return index % 2 === 0
      ? "I think they will be ready because they made a plan for next time."
      : "Mara learns that people can help with a big problem. They each did a small part.";
  }
  if (task.profile === "developing") {
    return `The group will probably work together again. The text says ${shortEvidence.toLowerCase()}.`;
  }
  if (task.profile === "strong") {
    return `Mara learns that planning and teamwork can make a difficult problem manageable. One useful detail is that ${shortEvidence.toLowerCase()}.`;
  }
  return index % 2 === 0
    ? `They will probably follow their storm plan and divide the work. This makes sense because ${shortEvidence.toLowerCase()}.`
    : `The lesson is that a large problem becomes easier when people plan and cooperate. The story shows this when ${shortEvidence.toLowerCase()}.`;
}

async function generateWrittenResponses(tasks: ShowcaseWrittenTask[], gradeLevel: string) {
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
      response_format: { type: "json_object" },
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
    const seen = new Set<string>();
    for (const item of parsed.responses) {
      const task = tasks.find((candidate) => candidate.studentId === item.studentId);
      if (!task) continue;
      const normalized = item.answerText.replace(/\s+/g, " ").trim().slice(0, 800);
      const duplicateKey = normalized.toLowerCase();
      if (!normalized || seen.has(duplicateKey)) continue;
      seen.add(duplicateKey);
      fallback.set(`${task.studentId}:${task.questionId}`, normalized);
    }
    return { responses: fallback, usedOpenAI: parsed.responses.length > 0 };
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

export async function runShowcaseTick(teacherId: string) {
  const now = new Date();
  const claimed = await prisma.teacher.updateMany({
    where: {
      id: teacherId,
      isShowcase: true,
      showcaseExpiresAt: { gt: now },
      OR: [
        { showcaseNextTickAt: null },
        { showcaseNextTickAt: { lte: now } }
      ]
    },
    // Hold the claim longer than the OpenAI timeout so two open tabs cannot
    // generate or write the same student's next response concurrently.
    data: { showcaseNextTickAt: new Date(now.getTime() + 45_000) }
  });
  if (claimed.count !== 1) {
    return { advanced: false, started: 0, answered: 0, completed: 0, usedOpenAI: false };
  }

  const materials = await prisma.material.findMany({
    where: {
      teacherId,
      status: MaterialStatus.PUBLISHED,
      activityKind: ActivityKind.IN_CLASS,
      isAdaptiveHome: false,
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

  const material = materials.find((candidate) => {
    const completedIds = new Set(
      candidate.sessions.filter((session) => session.status === "COMPLETED").map((session) => session.studentId)
    );
    return candidate.classroom.students.some((student) => !completedIds.has(student.id));
  });
  if (!material) {
    await scheduleNextShowcaseTick(teacherId);
    return { advanced: false, started: 0, answered: 0, completed: 0, usedOpenAI: false };
  }

  const activeSessions = material.sessions
    .filter((session) => session.status === "IN_PROGRESS")
    .sort((a, b) => a.answers.length - b.answers.length || a.signInAt.getTime() - b.signInAt.getTime());
  const startedStudentIds = new Set(material.sessions.map((session) => session.studentId));
  const startSlots = Math.max(0, 4 - activeSessions.length);
  const studentsToStart = material.classroom.students
    .filter((student) => !startedStudentIds.has(student.id))
    .slice(0, Math.min(2, startSlots));
  if (studentsToStart.length > 0) {
    await Promise.all(studentsToStart.map((student, index) => prisma.studentSession.create({
      data: {
        studentId: student.id,
        materialId: material.id,
        signInAt: new Date(now.getTime() + index * 250),
        lastSeenAt: now,
        openedBook: true
      }
    })));
  }

  const candidates = activeSessions.slice(0, 3).map((session) => {
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
  const generated = await generateWrittenResponses(writtenTasks, material.classroom.gradeLevel);

  let completed = 0;
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
      if (isComplete) completed += 1;
    }
  });

  await scheduleNextShowcaseTick(teacherId);

  return {
    advanced: studentsToStart.length > 0 || candidates.length > 0,
    materialId: material.id,
    classroomId: material.classroomId,
    started: studentsToStart.length,
    answered: candidates.length,
    completed,
    usedOpenAI: generated.usedOpenAI
  };
}
