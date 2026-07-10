import "server-only";

import { ActivityKind, MaterialStatus, QuestionType } from "@prisma/client";
import { generateAtHomePractice, type HomePracticeQuestion } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { excerptForIndex } from "@/lib/text-context";

export function homeLearningDayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export async function classroomHasHomeLearningSources(classroomId: string) {
  const [materialCount, resourceCount] = await Promise.all([
    prisma.material.count({
      where: { classroomId, activityKind: ActivityKind.IN_CLASS, isAdaptiveHome: false }
    }),
    prisma.atHomeResource.count({ where: { classroomId } })
  ]);
  return materialCount + resourceCount > 0;
}

function choicesFromJson(value?: string | null) {
  if (!value) return [];
  try {
    return JSON.parse(value) as string[];
  } catch {
    return [];
  }
}

function normalizePrompt(prompt: string) {
  return prompt.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function promptsAreSimilar(left: string, right: string) {
  const leftWords = new Set(normalizePrompt(left).split(" ").filter((word) => word.length > 2));
  const rightWords = new Set(normalizePrompt(right).split(" ").filter((word) => word.length > 2));
  if (!leftWords.size || !rightWords.size) return false;
  const overlap = [...leftWords].filter((word) => rightWords.has(word)).length;
  return overlap / Math.min(leftWords.size, rightWords.size) >= 0.72;
}

function readingRange(scope?: string | null) {
  if (!scope) return null;
  const pageRange = scope.match(/pages?\s*(\d+)\s*(?:-|–|—|to|through)\s*(\d+)/i);
  if (pageRange) return { kind: "page" as const, start: Number(pageRange[1]), end: Number(pageRange[2]) };
  const throughPage = scope.match(/(?:through|until|to)?\s*page\s*(\d+)/i);
  if (throughPage) return { kind: "page" as const, start: 1, end: Number(throughPage[1]) };
  const chapterRange = scope.match(/chapters?\s*(\d+)\s*(?:-|–|—|to|through)\s*(\d+)/i);
  if (chapterRange) return { kind: "chapter" as const, start: Number(chapterRange[1]), end: Number(chapterRange[2]) };
  const throughChapter = scope.match(/(?:through|until|to)?\s*chapter\s*(\d+)/i);
  if (throughChapter) return { kind: "chapter" as const, start: 1, end: Number(throughChapter[1]) };
  return null;
}

export function applyReadingScope(text: string, scope?: string | null) {
  const range = readingRange(scope);
  if (!range || !text) return text;

  if (range.kind === "page" && /\[\[PAGE \d+\]\]/i.test(text)) {
    const startMarker = new RegExp(`\\[\\[PAGE ${range.start}\\]\\]`, "i");
    const endMarker = new RegExp(`\\[\\[PAGE ${range.end + 1}\\]\\]`, "i");
    const startIndex = range.start > 1 ? text.search(startMarker) : 0;
    const remainder = text.slice(Math.max(0, startIndex));
    const endIndex = remainder.search(endMarker);
    return (endIndex >= 0 ? remainder.slice(0, endIndex) : remainder).trim();
  }

  if (range.kind === "chapter") {
    const startMarker = new RegExp(`(?:chapter|ch\\.)\\s*${range.start}\\b`, "i");
    const endMarker = new RegExp(`(?:chapter|ch\\.)\\s*${range.end + 1}\\b`, "i");
    const startIndex = range.start > 1 ? text.search(startMarker) : 0;
    const remainder = text.slice(Math.max(0, startIndex));
    const endIndex = remainder.search(endMarker);
    return (endIndex >= 0 ? remainder.slice(0, endIndex) : remainder).trim();
  }

  return text;
}

function topicProfile(answers: Array<{
  isCorrect: boolean | null;
  question: { skillTag: string | null; standardCode: string | null };
}>) {
  const topicStats = new Map<string, { attempts: number; correct: number }>();
  for (const answer of answers) {
    const topic = answer.question.skillTag || answer.question.standardCode || "Close reading";
    const current = topicStats.get(topic) || { attempts: 0, correct: 0 };
    current.attempts += 1;
    if (answer.isCorrect) current.correct += 1;
    topicStats.set(topic, current);
  }
  const ranked = [...topicStats.entries()].map(([topic, stats]) => ({
    topic,
    attempts: stats.attempts,
    accuracy: stats.attempts ? stats.correct / stats.attempts : 0
  }));
  return {
    weakTopics: ranked
      .filter((item) => item.accuracy < 0.75)
      .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts)
      .slice(0, 5)
      .map((item) => item.topic),
    reinforcementTopics: ranked
      .filter((item) => item.accuracy >= 0.75)
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 5)
      .map((item) => item.topic)
  };
}

function instantQuestionsFromReading(
  sourceText: string,
  gradeLevel: string,
  excludedPrompts: Set<string>,
  limit: number
): HomePracticeQuestion[] {
  const gradeCode = gradeLevel.toUpperCase() === "K" ? "K" : gradeLevel;
  const sentences = sourceText
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\[\[PAGE \d+\]\]/gi, "").replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length >= 35 && sentence.length <= 180);
  const wordPool = [...new Set(sentences.flatMap((sentence) => sentence.match(/\b[A-Za-z]{6,}\b/g) || []))];
  const output: HomePracticeQuestion[] = [];
  for (let index = 0; index < sentences.length && output.length < limit; index += 1) {
    const sentence = sentences[index];
    const correctAnswer = [...(sentence.match(/\b[A-Za-z]{6,}\b/g) || [])].sort((a, b) => b.length - a.length)[0];
    if (!correctAnswer) continue;
    const prompt = `Which word best completes this sentence from the reading? “${sentence.replace(correctAnswer, "_____") }”`;
    if (excludedPrompts.has(normalizePrompt(prompt))) continue;
    const distractors = wordPool.filter((word) => word.toLowerCase() !== correctAnswer.toLowerCase()).slice(index + 1, index + 4);
    while (distractors.length < 3) distractors.push(["because", "another", "before"][distractors.length]);
    output.push({
      type: "VOCAB",
      prompt,
      contextExcerpt: excerptForIndex(sourceText, index).excerpt,
      sourcePage: excerptForIndex(sourceText, index).sourcePage || undefined,
      choices: [correctAnswer, ...distractors.slice(0, 3)],
      correctAnswer,
      explanation: `The sentence uses “${correctAnswer},” so that word completes the idea correctly.`,
      skillTag: "Vocabulary in context",
      standardCode: `L.${gradeCode}.4`,
      difficulty: 2 + (index % 3)
    });
  }
  return output;
}

export async function ensureDailyHomePractice(studentId: string) {
  const dayKey = homeLearningDayKey();
  const seriesKey = `adaptive-home:${dayKey}`;
  const existing = await prisma.material.findFirst({
    where: { targetStudentId: studentId, seriesKey, isAdaptiveHome: true }
  });
  if (existing) return existing;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { classroom: true }
  });
  if (!student) throw new Error("Student not found.");

  const [materials, resources, priorAnswers] = await Promise.all([
    prisma.material.findMany({
      where: {
        classroomId: student.classroomId,
        activityKind: ActivityKind.IN_CLASS,
        isAdaptiveHome: false
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: { questions: { orderBy: { sortOrder: "asc" } } }
    }),
    prisma.atHomeResource.findMany({
      where: { classroomId: student.classroomId },
      orderBy: { createdAt: "desc" },
      take: 8
    }),
    prisma.studentAnswer.findMany({
      where: { session: { studentId, material: { classroomId: student.classroomId } } },
      orderBy: { updatedAt: "desc" },
      take: 500,
      include: {
        question: { select: { prompt: true, skillTag: true, standardCode: true } },
        session: { select: { material: { select: { activityKind: true } } } }
      }
    })
  ]);
  if (!materials.length && !resources.length) {
    throw new Error("Your teacher has not added at-home learning material yet.");
  }

  const sourceParts: string[] = [];
  const scopes: string[] = [];
  for (const material of materials) {
    if (material.atHomeScope) scopes.push(material.atHomeScope);
    const reading = applyReadingScope(material.sourceText || material.sourcePreview || "", material.atHomeScope);
    const questionText = material.questions.map((question) => [
      `Question: ${question.prompt}`,
      choicesFromJson(question.choicesJson).length === 4
        ? `Choices: ${choicesFromJson(question.choicesJson).join(" | ")}`
        : "",
      question.correctAnswer ? `Teacher answer: ${question.correctAnswer}` : "",
      question.skillTag ? `Skill: ${question.skillTag}` : ""
    ].filter(Boolean).join("\n")).join("\n");
    sourceParts.push([
      `Reading or assignment: ${material.title}`,
      material.atHomeScope ? `Reading boundary: ${material.atHomeScope}` : "",
      reading,
      material.sourceText && material.atHomeScope ? "" : questionText
    ].filter(Boolean).join("\n"));
  }
  for (const resource of resources) {
    if (resource.readingScope) scopes.push(resource.readingScope);
    sourceParts.push([
      `Reading: ${resource.title}`,
      resource.readingScope ? `Reading boundary: ${resource.readingScope}` : "",
      applyReadingScope(resource.sourceText, resource.readingScope)
    ].filter(Boolean).join("\n"));
  }
  const sourceText = sourceParts.join("\n\n").slice(0, 24_000);

  const correctlyAnsweredAtHome = new Set(
    priorAnswers
      .filter((answer) => answer.isCorrect && answer.session.material.activityKind === ActivityKind.AT_HOME)
      .map((answer) => normalizePrompt(answer.question.prompt))
  );
  const seedQuestions: HomePracticeQuestion[] = [];
  for (const material of materials) {
    if (material.sourceText && material.atHomeScope) continue;
    for (const question of material.questions) {
      const choices = choicesFromJson(question.choicesJson);
      if (choices.length !== 4 || !question.correctAnswer || !choices.includes(question.correctAnswer)) continue;
      if (/^enter question \d+$/i.test(question.prompt)) continue;
      if (correctlyAnsweredAtHome.has(normalizePrompt(question.prompt))) continue;
      if (seedQuestions.some((seed) => normalizePrompt(seed.prompt) === normalizePrompt(question.prompt))) continue;
      seedQuestions.push({
        type: question.type === QuestionType.VOCAB ? "VOCAB" : "COMPREHENSION",
        prompt: question.prompt,
        contextExcerpt: question.contextExcerpt || undefined,
        sourcePage: question.sourcePage || undefined,
        choices,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation || `“${question.correctAnswer}” is the answer that best matches the reading.`,
        skillTag: question.skillTag || "Close reading",
        standardCode: question.standardCode || `RL.${student.classroom.gradeLevel}.1`,
        difficulty: question.difficulty
      });
      if (seedQuestions.length >= 8) break;
    }
    if (seedQuestions.length >= 8) break;
  }
  if (seedQuestions.length < 6) {
    seedQuestions.push(...instantQuestionsFromReading(
      sourceText,
      student.classroom.gradeLevel,
      new Set([...correctlyAnsweredAtHome, ...seedQuestions.map((question) => normalizePrompt(question.prompt))]),
      6 - seedQuestions.length
    ));
  }
  if (!seedQuestions.length) throw new Error("Charlotte needs readable questions or text from your teacher before starting.");

  const titleDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "long",
    day: "numeric"
  }).format(new Date());

  try {
    return await prisma.material.create({
      data: {
        teacherId: student.classroom.teacherId,
        classroomId: student.classroomId,
        targetStudentId: student.id,
        title: `Daily Win · ${titleDate}`,
        gradeLevel: student.classroom.gradeLevel,
        estimatedMinutes: 20,
        activityKind: ActivityKind.AT_HOME,
        status: MaterialStatus.PUBLISHED,
        availableAt: new Date(),
        seriesKey,
        isAdaptiveHome: true,
        atHomeScope: scopes.join("; ").slice(0, 500) || null,
        generationNotes: "Opened instantly from teacher-approved questions; more questions generate while the student works.",
        sourcePreview: sourceText.slice(0, 1200),
        sourceText,
        questions: {
          create: seedQuestions.map((question, index) => ({
            type: question.type,
            prompt: question.prompt,
            choicesJson: JSON.stringify(question.choices),
            correctAnswer: question.correctAnswer,
            explanation: question.explanation,
            contextExcerpt: question.contextExcerpt || null,
            sourcePage: question.sourcePage || null,
            skillTag: question.skillTag,
            standardCode: question.standardCode,
            difficulty: question.difficulty,
            randomizeChoices: true,
            sortOrder: index + 1
          }))
        }
      }
    });
  } catch {
    const raced = await prisma.material.findFirst({
      where: { targetStudentId: studentId, seriesKey, isAdaptiveHome: true }
    });
    if (raced) return raced;
    throw new Error("Charlotte could not prepare today's at-home practice.");
  }
}

export async function extendDailyHomePractice(sessionId: string, studentId: string) {
  const session = await prisma.studentSession.findFirst({
    where: { id: sessionId, studentId, status: "IN_PROGRESS" },
    include: {
      material: { include: { questions: { orderBy: { sortOrder: "asc" } } } }
    }
  });
  if (!session || session.material.activityKind !== ActivityKind.AT_HOME || !session.material.isAdaptiveHome) {
    throw new Error("At-home session not found.");
  }

  const priorAnswers = await prisma.studentAnswer.findMany({
    where: { session: { studentId, material: { classroomId: session.material.classroomId } } },
    orderBy: { updatedAt: "desc" },
    take: 500,
    include: { question: { select: { prompt: true, skillTag: true, standardCode: true } } }
  });
  const { weakTopics, reinforcementTopics } = topicProfile(priorAnswers);
  const excludedPrompts = [
    ...session.material.questions.map((question) => question.prompt),
    ...priorAnswers.filter((answer) => answer.isCorrect).map((answer) => answer.question.prompt)
  ];
  const generated = await generateAtHomePractice({
    gradeLevel: session.material.gradeLevel,
    sourceText: session.material.sourceText || session.material.sourcePreview || "",
    weakTopics,
    reinforcementTopics,
    questionCount: 10,
    excludePrompts: excludedPrompts,
    readingScope: session.material.atHomeScope || undefined
  });

  const existing = new Set(excludedPrompts.map(normalizePrompt));
  const acceptedPrompts = [...excludedPrompts];
  const bannedStudentLanguage = /teacher material|supplied material|source text|today'?s practice|theme practice|comprehension practice/i;
  const unique = generated.questions.filter((question) => {
    const normalized = normalizePrompt(question.prompt);
    if (
      !normalized ||
      existing.has(normalized) ||
      acceptedPrompts.some((prompt) => promptsAreSimilar(prompt, question.prompt)) ||
      bannedStudentLanguage.test(question.prompt)
    ) return false;
    existing.add(normalized);
    acceptedPrompts.push(question.prompt);
    return question.choices.length === 4 && question.choices.includes(question.correctAnswer);
  });
  if (!unique.length) return [];

  const startOrder = session.material.questions.length + 1;
  return Promise.all(unique.map((question, index) => prisma.question.create({
    data: {
      materialId: session.materialId,
      type: question.type,
      prompt: question.prompt,
      choicesJson: JSON.stringify(question.choices),
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      contextExcerpt: question.contextExcerpt || null,
      sourcePage: question.sourcePage || null,
      skillTag: question.skillTag,
      standardCode: question.standardCode,
      difficulty: question.difficulty,
      randomizeChoices: true,
      sortOrder: startOrder + index
    }
  })));
}
