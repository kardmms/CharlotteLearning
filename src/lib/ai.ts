import OpenAI from "openai";
import { z } from "zod";
import { standardsReferenceForGrade } from "@/lib/standards";
import { sourceExcerptWindows } from "@/lib/text-context";

const GeneratedQuestionSchema = z.object({
  type: z.enum(["VOCAB", "COMPREHENSION", "PREDICTION", "SHORT_RESPONSE"]),
  prompt: z.string().min(10),
  choices: z.array(z.string()).optional(),
  correctAnswer: z.string().optional(),
  rubric: z.string().optional(),
  skillTag: z.string().optional(),
  standardCode: z.string().optional(),
  explanation: z.string().optional(),
  contextExcerpt: z.string().optional(),
  sourcePage: z.string().optional(),
  difficulty: z.number().int().min(1).max(5).default(3)
});

const GeneratedMaterialSchema = z.object({
  notes: z.string().optional(),
  questions: z.array(GeneratedQuestionSchema).min(5).max(10)
});

const StudentRosterSchema = z.object({
  students: z.array(z.object({
    displayName: z.string(),
    email: z.string()
  })).max(200)
});

export type StudentRosterRow = z.infer<typeof StudentRosterSchema>["students"][number];

export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;

const HomePracticeQuestionSchema = z.object({
  type: z.enum(["VOCAB", "COMPREHENSION"]),
  prompt: z.string().min(10),
  choices: z.array(z.string().min(1)).length(4),
  correctAnswer: z.string().min(1),
  explanation: z.string().min(10),
  skillTag: z.string().min(2),
  standardCode: z.string().min(2),
  contextExcerpt: z.string().optional(),
  sourcePage: z.string().optional(),
  difficulty: z.number().int().min(1).max(5).default(3)
}).refine((question) => question.choices.includes(question.correctAnswer), {
  message: "The correct answer must exactly match one choice."
});

const HomePracticeSchema = z.object({
  notes: z.string().optional(),
  questions: z.array(HomePracticeQuestionSchema).min(1).max(12)
});

export type HomePracticeQuestion = z.infer<typeof HomePracticeQuestionSchema>;

function openAiApiKey() {
  return process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY || "";
}

function gradeLevelLanguageRule(gradeLevel: string) {
  const normalized = gradeLevel.toUpperCase() === "K" ? 0 : Number.parseInt(gradeLevel, 10);
  if (Number.isNaN(normalized)) {
    return "Use clear student-facing language. Keep the support wording easier than the skill being assessed.";
  }
  if (normalized <= 2) {
    return "Use very short sentences, familiar words, and concrete choices. Ask one thing at a time. Do not use academic words unless the question directly teaches that word.";
  }
  if (normalized <= 5) {
    return "Use elementary-grade wording: common words, direct questions, and short answer choices. Keep academic or challenging words only when they are the target vocabulary from the reading.";
  }
  if (normalized <= 8) {
    return "Use middle-school wording: clear academic language is okay only when it is part of the assessed skill. Avoid unnecessary jargon in prompts and distractors.";
  }
  return "Use high-school-appropriate wording, but still avoid needless jargon. The challenge should come from interpretation, evidence, and vocabulary from the text.";
}

function cleanContextExcerpt(value?: string | null) {
  return value
    ?.replace(/\[\[PAGE \d+\]\]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 900) || undefined;
}

function normalizeGeneratedQuestion(question: GeneratedQuestion, fallbackContext?: {
  contextExcerpt?: string | null;
  sourcePage?: string | null;
}): GeneratedQuestion {
  const contextExcerpt = cleanContextExcerpt(question.contextExcerpt) || cleanContextExcerpt(fallbackContext?.contextExcerpt);
  const sourcePage = (question.sourcePage || fallbackContext?.sourcePage || "").trim().slice(0, 80) || undefined;
  if (!question.choices?.length) return { ...question, contextExcerpt, sourcePage };

  const choices = question.choices
    .map((choice) => choice.trim())
    .filter(Boolean)
    .slice(0, 4);
  if (choices.length === 0) return { ...question, contextExcerpt, sourcePage, choices: undefined, correctAnswer: undefined };

  const rawAnswer = question.correctAnswer?.trim() || "";
  const letterMatch = rawAnswer.match(/^[A-D]$/i);
  const letterChoice = letterMatch ? choices[rawAnswer.toUpperCase().charCodeAt(0) - 65] : undefined;
  const exactChoice = choices.find((choice) => choice === rawAnswer);
  const caseChoice = choices.find((choice) => choice.toLowerCase() === rawAnswer.toLowerCase());
  const containedChoice = choices.find((choice) =>
    rawAnswer.toLowerCase().includes(choice.toLowerCase()) ||
    choice.toLowerCase().includes(rawAnswer.toLowerCase())
  );

  return {
    ...question,
    contextExcerpt,
    sourcePage,
    choices,
    correctAnswer: exactChoice || letterChoice || caseChoice || containedChoice || choices[0]
  };
}

function normalizeHomePracticeQuestion(
  question: HomePracticeQuestion,
  fallbackContext?: { contextExcerpt?: string | null; sourcePage?: string | null }
): HomePracticeQuestion {
  return {
    ...question,
    contextExcerpt: cleanContextExcerpt(question.contextExcerpt) || cleanContextExcerpt(fallbackContext?.contextExcerpt),
    sourcePage: (question.sourcePage || fallbackContext?.sourcePage || "").trim().slice(0, 80) || undefined
  };
}

function fallbackStudentRoster(values: unknown[][]): StudentRosterRow[] {
  const rows = values.map((row) => row.map((value) => String(value ?? "").trim()));
  const headerIndex = rows.findIndex((row) => row.some((value) => {
    const label = value.toLowerCase();
    return label.includes("email") || label.includes("student") || label.includes("password");
  }));
  const header = headerIndex >= 0 ? rows[headerIndex].map((value) => value.toLowerCase()) : [];
  const nameIndex = headerIndex >= 0
    ? Math.max(0, header.findIndex((value) => value === "name" || value.includes("student name")))
    : 0;
  const emailIndex = headerIndex >= 0
    ? Math.max(1, header.findIndex((value) => value.includes("email")))
    : 1;
  const body = headerIndex >= 0 ? rows.slice(headerIndex + 1) : rows;
  return body
    .map((row) => ({
      displayName: row[nameIndex] || "",
      email: row[emailIndex] || ""
    }))
    .filter((row) => row.displayName || row.email)
    .slice(0, 200);
}

export async function extractStudentRosterWithAI(values: unknown[][]) {
  const compactValues = values.slice(0, 250).map((row) =>
    row.slice(0, 12).map((value) => String(value ?? "").trim().slice(0, 200))
  );
  const fallback = fallbackStudentRoster(compactValues);
  const apiKey = openAiApiKey();
  if (!apiKey) return fallback;

  try {
    const openai = new OpenAI({ apiKey });
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You extract student roster data from spreadsheet cells. Return JSON only. Never invent missing information."
        },
        {
          role: "user",
          content: [
            "Identify each student row even if headers are unusual or columns are out of order. Ignore password columns.",
            "Return exactly this shape:",
            '{"students":[{"displayName":"student name","email":"email"}]}',
            "Use an empty string for any missing value and omit headings, notes, and blank rows.",
            `Spreadsheet cells: ${JSON.stringify(compactValues)}`
          ].join("\n")
        }
      ]
    });
    const raw = completion.choices[0]?.message.content;
    if (!raw) return fallback;
    return StudentRosterSchema.parse(JSON.parse(raw)).students;
  } catch {
    return fallback;
  }
}

export async function generateQuestionsFromText(input: {
  title: string;
  gradeLevel: string;
  estimatedMinutes: number;
  text: string;
  activityFocus?: string;
  activityLabel?: string;
}) {
  const fallbackContexts = sourceExcerptWindows(input.text, 24);
  const apiKey = openAiApiKey();
  if (!apiKey) return demoQuestions(input);

  const openai = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.35,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You create rigorous, age-appropriate literacy reinforcement questions for teachers. Return valid JSON only."
      },
      {
        role: "user",
        content: [
          `Create one ${input.estimatedMinutes}-minute student exercise for grade ${input.gradeLevel}.`,
          `Material title: ${input.title}.`,
          input.activityLabel ? `Activity label: ${input.activityLabel}.` : "",
          input.activityFocus ? `Instructional focus: ${input.activityFocus}.` : "",
          gradeLevelLanguageRule(input.gradeLevel),
          "The questions must reward close attention, inference, vocabulary-in-context, and evidence from the uploaded text.",
          "Avoid easy yes/no questions. Avoid questions answerable without reading.",
          "Keep the support wording simple and student-friendly. Challenge may live in the target vocabulary word, inference, evidence, or idea—not in accidental extra words in the question or answer choices.",
          "If a hard word is not the target vocabulary word or the actual skill being assessed, replace it with a clear grade-level synonym.",
          "Avoid answer choices such as 'not just or equitable' unless the question is directly teaching those words. Prefer clearer support wording such as 'not fair.'",
          "When a question asks about a specific part of the reading, include a 2-3 sentence contextExcerpt copied or lightly cleaned from the uploaded text so students do not have to hunt for the passage.",
          "Also include sourcePage. Prefer a visible book page number, chapter-page label, or printed page marker near the excerpt. If the PDF combines multiple book pages on one PDF page, choose the visible book page closest to the excerpt. If no book page is visible, use the nearest [[PAGE n]] marker as 'PDF page n'.",
          "Do not put the context excerpt inside the prompt. Put it only in contextExcerpt.",
          "Every question must be genuinely aligned to one California Common Core ELA/Literacy standard for the target grade.",
          "Use exactly this JSON shape:",
          '{"notes":"short teacher note","questions":[{"type":"VOCAB|COMPREHENSION|PREDICTION|SHORT_RESPONSE","prompt":"...","contextExcerpt":"2-3 sentence excerpt students should read first","sourcePage":"book page 12 or PDF page 3","choices":["A","B","C","D"],"correctAnswer":"...","rubric":"...","skillTag":"...","standardCode":"RL.3.1","difficulty":1}]}',
          "Create 8 questions: 3 VOCAB multiple-choice, 3 COMPREHENSION multiple-choice, 1 PREDICTION written response, and 1 SHORT_RESPONSE evidence question.",
          "For multiple-choice questions, include 4 choices and a correctAnswer exactly matching one choice.",
          "For written questions, include a concise teacher rubric instead of a correctAnswer.",
          "California standards reference:",
          standardsReferenceForGrade(input.gradeLevel),
          `Uploaded text excerpt: ${input.text}`
        ].join("\n")
      }
    ]
  });

  const raw = completion.choices[0]?.message.content;
  if (!raw) throw new Error("OpenAI did not return question content.");

  const parsed = GeneratedMaterialSchema.parse(JSON.parse(raw));
  return {
    ...parsed,
    questions: parsed.questions.map((question, index) =>
      normalizeGeneratedQuestion(question, fallbackContexts[index % Math.max(1, fallbackContexts.length)])
    )
  };
}

export async function generateAtHomePractice(input: {
  gradeLevel: string;
  sourceText: string;
  weakTopics: string[];
  reinforcementTopics: string[];
  questionCount?: number;
  excludePrompts?: string[];
  readingScope?: string;
}) {
  const fallbackContexts = sourceExcerptWindows(input.sourceText, 36);
  const fallback = fallbackAtHomePractice(input);
  const apiKey = openAiApiKey();
  if (!apiKey) return fallback;

  try {
    const openai = new OpenAI({ apiKey, timeout: 12_000, maxRetries: 1 });
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const questionCount = Math.min(12, Math.max(1, input.questionCount || 10));
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You write natural, classroom-quality reading-comprehension questions for children. Use only the supplied reading and teacher questions for factual content. Return valid JSON only."
        },
        {
          role: "user",
          content: [
            `Create exactly ${questionCount} new multiple-choice questions for a grade ${input.gradeLevel} student.`,
            gradeLevelLanguageRule(input.gradeLevel),
            "Use a mix of vocabulary and comprehension. Every question needs four plausible choices, one exact correct answer, and a short teaching explanation shown after the student responds.",
            input.weakTopics.length
              ? `Spend about two thirds of the questions strengthening these weak topics: ${input.weakTopics.join(", ")}.`
              : "No weak topic is established yet, so balance the practice across the supplied material.",
            input.reinforcementTopics.length
              ? `Use the remaining questions to reinforce these successful or recently taught topics: ${input.reinforcementTopics.join(", ")}.`
              : "Use the remaining questions for close reading, evidence, vocabulary in context, and main idea.",
            "Keep language, sentence length, distractors, and standards appropriate for the class grade.",
            "Keep the hard thinking in the target skill: vocabulary-in-context, inference, evidence, main idea, or close reading. Do not accidentally make answer choices hard because of unrelated advanced words.",
            "If a challenging word is the vocabulary target, keep it. If a challenging word is only support language in a prompt or distractor, use an easier synonym.",
            "Avoid answer choices like 'not just or equitable' unless those exact words are being taught. Use child-friendly choices such as 'not fair' when fairness is only support language.",
            "Write questions that look like real reading practice: ask directly about characters, events, details, vocabulary, sequence, cause and effect, main idea, inference, or evidence.",
            "Never use phrases such as teacher material, supplied material, source text, today's practice, theme practice, or comprehension practice in a student-facing question or answer.",
            "For each question, include a 2-3 sentence contextExcerpt from the reading so the student has enough context without going back to the full book.",
            "Also include sourcePage. Prefer the printed book page number or page label visible near the excerpt. If one PDF page contains multiple book pages, use the visible book page closest to the excerpt. If no book page is visible, use the nearest [[PAGE n]] marker as 'PDF page n'.",
            "Do not put the excerpt inside the prompt. The prompt should ask the question after the separate excerpt.",
            "Do not ask the same idea in slightly different words. Each question must test a distinct detail or skill.",
            input.readingScope ? `Hard reading boundary: ${input.readingScope}. Do not ask about any chapter or page beyond this limit.` : "Stay within the supplied reading only.",
            input.excludePrompts?.length
              ? `Do not repeat or closely paraphrase any of these previously shown questions: ${JSON.stringify(input.excludePrompts.slice(-80))}`
              : "Do not repeat a question within this batch.",
            "Do not ask for personal information. Do not introduce facts that are absent from the reading.",
            "Use exactly this JSON shape:",
            '{"notes":"short teacher-facing generation note","questions":[{"type":"VOCAB|COMPREHENSION","prompt":"...","contextExcerpt":"2-3 sentence excerpt students should read first","sourcePage":"book page 12 or PDF page 3","choices":["...","...","...","..."],"correctAnswer":"exact matching choice","explanation":"brief supportive teaching explanation","skillTag":"...","standardCode":"RL.3.1","difficulty":3}]}',
            "California standards reference:",
            standardsReferenceForGrade(input.gradeLevel),
            `Teacher material: ${input.sourceText.slice(0, 18000)}`
          ].join("\n")
        }
      ]
    });

    const raw = completion.choices[0]?.message.content;
    if (!raw) return fallback;
    const parsed = HomePracticeSchema.parse(JSON.parse(raw));
    return {
      ...parsed,
      questions: parsed.questions.map((question, index) =>
        normalizeHomePracticeQuestion(question, fallbackContexts[index % Math.max(1, fallbackContexts.length)])
      )
    };
  } catch {
    return fallback;
  }
}

function fallbackAtHomePractice(input: {
  gradeLevel: string;
  sourceText: string;
  weakTopics: string[];
  reinforcementTopics: string[];
  questionCount?: number;
  excludePrompts?: string[];
  readingScope?: string;
}) {
  const gradeCode = input.gradeLevel.toUpperCase() === "K" ? "K" : input.gradeLevel;
  const questionCount = Math.min(12, Math.max(1, input.questionCount || 10));
  const fallbackContexts = sourceExcerptWindows(input.sourceText, questionCount + 8);
  const excluded = new Set((input.excludePrompts || []).map((prompt) => prompt.trim().toLowerCase()));
  const teacherQuestions = input.sourceText
    .split(/\n(?=Question:)/i)
    .map((block) => {
      const prompt = block.match(/Question:\s*(.+)/i)?.[1]?.trim();
      const choices = block.match(/Choices:\s*(.+)/i)?.[1]?.split(" | ").map((choice) => choice.trim()).filter(Boolean) || [];
      const correctAnswer = block.match(/Teacher answer:\s*(.+)/i)?.[1]?.trim();
      const skillTag = block.match(/Skill:\s*(.+)/i)?.[1]?.trim() || "Close reading";
      if (!prompt || choices.length !== 4 || !correctAnswer || !choices.includes(correctAnswer)) return null;
      return { prompt, choices, correctAnswer, skillTag };
    })
    .filter((question): question is NonNullable<typeof question> => Boolean(question))
    .filter((question) => !excluded.has(question.prompt.toLowerCase()));

  const questions: HomePracticeQuestion[] = teacherQuestions.slice(0, questionCount).map((question, index) => ({
    type: (index % 3 === 0 ? "VOCAB" : "COMPREHENSION") as "VOCAB" | "COMPREHENSION",
    prompt: question.prompt,
    choices: question.choices,
    correctAnswer: question.correctAnswer,
    explanation: `The best answer is “${question.correctAnswer}” because it matches the detail or idea taught in the reading.`,
    skillTag: question.skillTag,
    standardCode: `RL.${gradeCode}.1`,
    difficulty: Math.min(5, 2 + (index % 4))
  })).map((question, index) =>
    normalizeHomePracticeQuestion(question, fallbackContexts[index % Math.max(1, fallbackContexts.length)])
  );

  const sentences = input.sourceText
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\[\[PAGE \d+\]\]/g, "").replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length >= 35 && sentence.length <= 220);
  const topics = [...input.weakTopics, ...input.reinforcementTopics].filter(Boolean);
  const wordPool = [...new Set(sentences.flatMap((sentence) =>
    sentence.match(/\b[A-Za-z]{6,}\b/g) || []
  ))];
  for (let index = 0; questions.length < questionCount && index < sentences.length; index += 1) {
    const sentence = sentences[index];
    const candidates = sentence.match(/\b[A-Za-z]{6,}\b/g) || [];
    const correctAnswer = [...candidates].sort((a, b) => b.length - a.length)[0];
    if (!correctAnswer) continue;
    const prompt = `Which word best completes this sentence from the reading? “${sentence.replace(correctAnswer, "_____") }”`;
    if (excluded.has(prompt.toLowerCase())) continue;
    const distractors = wordPool.filter((word) => word.toLowerCase() !== correctAnswer.toLowerCase()).slice(index, index + 3);
    while (distractors.length < 3) distractors.push(["because", "another", "before"][distractors.length]);
    questions.push(normalizeHomePracticeQuestion({
      type: "VOCAB",
      prompt,
      choices: [correctAnswer, ...distractors.slice(0, 3)],
      correctAnswer,
      explanation: `The original sentence uses “${correctAnswer},” which makes the sentence complete and accurate.`,
      skillTag: topics[index % Math.max(1, topics.length)] || "Vocabulary in context",
      standardCode: `L.${gradeCode}.4`,
      difficulty: Math.min(5, 2 + (index % 4))
    }, fallbackContexts[index % Math.max(1, fallbackContexts.length)]));
  }
  return {
    notes: "Practice created from teacher-approved questions and reading details.",
    questions
  };
}

function demoQuestions(input: {
  title: string;
  gradeLevel: string;
  estimatedMinutes: number;
  text: string;
  activityFocus?: string;
  activityLabel?: string;
}) {
  const gradeCode =
    input.gradeLevel.toUpperCase() === "K"
      ? "K"
      : Number(input.gradeLevel) >= 11
        ? "11-12"
        : Number(input.gradeLevel) >= 9
          ? "9-10"
          : input.gradeLevel;
  const sentences = input.text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => sentence.length > 40)
    .slice(0, 6);
  const fallbackContexts = sourceExcerptWindows(input.text, 12);
  const anchor = sentences[0] || input.text.slice(0, 160);
  const second = sentences[1] || anchor;

  return {
    notes:
      `Demo draft created locally${input.activityLabel ? ` for ${input.activityLabel}` : ""} because OPENAI_API_KEY is not set. Add the key to .env for source-based drafting.`,
    questions: [
      {
        type: "VOCAB" as const,
        prompt: `Which word from the passage most affects the meaning of this sentence: "${anchor.slice(0, 180)}"?`,
        choices: ["setting", "conflict", "detail", "transition"],
        correctAnswer: "detail",
        rubric: "",
        skillTag: "Vocabulary in context",
        standardCode: `RL.${gradeCode}.4`,
        difficulty: 3
      },
      {
        type: "VOCAB" as const,
        prompt: "Which choice best explains why authors repeat important descriptive words in a scene?",
        choices: [
          "To make the page longer",
          "To signal what the reader should notice",
          "To replace character dialogue",
          "To avoid giving evidence"
        ],
        correctAnswer: "To signal what the reader should notice",
        rubric: "",
        skillTag: "Author's craft",
        standardCode: `RL.${gradeCode}.4`,
        difficulty: 3
      },
      {
        type: "VOCAB" as const,
        prompt: "When a word has more than one meaning, what should a careful reader use first?",
        choices: [
          "The longest sentence on the page",
          "The first dictionary definition",
          "Nearby clues in the passage",
          "The title only"
        ],
        correctAnswer: "Nearby clues in the passage",
        rubric: "",
        skillTag: "Context clues",
        standardCode: `L.${gradeCode}.4`,
        difficulty: 2
      },
      {
        type: "COMPREHENSION" as const,
        prompt: `Based on this part of the text, what is the most important change happening: "${second.slice(0, 180)}"?`,
        choices: [
          "A character is facing a new problem",
          "The setting is no longer important",
          "The narrator stops the story",
          "The conflict has already ended"
        ],
        correctAnswer: "A character is facing a new problem",
        rubric: "",
        skillTag: "Close reading",
        standardCode: `RL.${gradeCode}.1`,
        difficulty: 4
      },
      {
        type: "COMPREHENSION" as const,
        prompt: "Which answer would need the strongest evidence from the text?",
        choices: [
          "Naming a character",
          "Explaining why a character made a choice",
          "Finding the title",
          "Counting sentences"
        ],
        correctAnswer: "Explaining why a character made a choice",
        rubric: "",
        skillTag: "Evidence",
        standardCode: `RL.${gradeCode}.1`,
        difficulty: 4
      },
      {
        type: "COMPREHENSION" as const,
        prompt: "What should a student do when two answer choices both seem partly true?",
        choices: [
          "Pick the shorter one",
          "Choose the one with the clearest text evidence",
          "Skip the question",
          "Pick the first one"
        ],
        correctAnswer: "Choose the one with the clearest text evidence",
        rubric: "",
        skillTag: "Reasoning",
        standardCode: `RL.${gradeCode}.1`,
        difficulty: 3
      },
      {
        type: "PREDICTION" as const,
        prompt:
          `Make a prediction connected to ${input.activityFocus || "the reading"}. Include one specific detail from the passage that supports your prediction.`,
        choices: [],
        correctAnswer: "",
        rubric:
          "Strong answers make a plausible prediction and cite one concrete detail from the material.",
        skillTag: "Prediction with evidence",
        standardCode: `RL.${gradeCode}.1`,
        difficulty: 4
      },
      {
        type: "SHORT_RESPONSE" as const,
        prompt:
          "What is one idea in the material that a reader could easily miss? Explain why that detail matters.",
        choices: [],
        correctAnswer: "",
        rubric:
          "Strong answers identify a meaningful detail, explain its importance, and connect it to the larger passage.",
        skillTag: "Written response",
        standardCode: `W.${gradeCode}.9`,
        difficulty: 5
      }
    ].map((question, index) =>
      normalizeGeneratedQuestion(question, fallbackContexts[index % Math.max(1, fallbackContexts.length)])
    )
  };
}

type SkillSummaryRow = {
  skill: string;
  attempts: number;
  correct: number;
  percentCorrect: number;
};

type StudentSummaryRow = {
  student: string;
  completed: boolean;
  answers: number;
  incorrect: number;
  lastSeen: string;
  material: string;
};

export async function summarizeClassData(input: {
  className: string;
  gradeLevel: string;
  studentCount: number;
  skillRows: SkillSummaryRow[];
  studentRows: StudentSummaryRow[];
}) {
  const apiKey = openAiApiKey();
  if (!apiKey) return fallbackClassSummary(input);

  const openai = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.25,
    messages: [
      {
        role: "system",
        content:
          "You help teachers interpret classroom reading practice data. Be specific, concise, and practical. Do not mention that you are an AI model."
      },
      {
        role: "user",
        content: [
          `Class: ${input.className}`,
          `Grade level: ${input.gradeLevel}`,
          `Students: ${input.studentCount}`,
          `Skill data: ${JSON.stringify(input.skillRows)}`,
          `Latest student data: ${JSON.stringify(input.studentRows)}`,
          "Write a teacher-facing summary with: 1) what students are doing well, 2) what they are struggling with, 3) who may need follow-up, and 4) one suggested next mini-lesson. Keep it under 180 words."
        ].join("\n")
      }
    ]
  });

  return completion.choices[0]?.message.content?.trim() || fallbackClassSummary(input);
}

function fallbackClassSummary(input: {
  className: string;
  gradeLevel: string;
  studentCount: number;
  skillRows: SkillSummaryRow[];
  studentRows: StudentSummaryRow[];
}) {
  const attemptedSkills = input.skillRows.filter((row) => row.attempts > 0);
  const strongest = [...attemptedSkills].sort((a, b) => b.percentCorrect - a.percentCorrect)[0];
  const weakest = [...attemptedSkills].sort((a, b) => a.percentCorrect - b.percentCorrect)[0];
  const followUps = input.studentRows
    .filter((row) => row.incorrect >= 2 || (!row.completed && row.answers > 0))
    .slice(0, 3)
    .map((row) => row.student);

  return [
    strongest
      ? `Students are strongest in ${strongest.skill} at ${strongest.percentCorrect}% correct.`
      : "There is not enough graded data yet to identify a strongest skill.",
    weakest
      ? `The main struggle area is ${weakest.skill}, with ${weakest.percentCorrect}% correct across ${weakest.attempts} attempts.`
      : "The class needs more completed multiple-choice attempts before a pattern is clear.",
    followUps.length
      ? `Students to check in with: ${followUps.join(", ")}.`
      : "No urgent individual follow-up is showing from the current data.",
    weakest
      ? `Suggested mini-lesson: review ${weakest.skill} with one model question, then have students explain which text detail proves the answer.`
      : "Suggested mini-lesson: model one evidence-based answer before the next station."
  ].join(" ");
}
