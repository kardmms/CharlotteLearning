import "server-only";

import crypto from "node:crypto";
import { ActivityKind, IdentityMode, MaterialStatus, QuestionType } from "@prisma/client";
import { prisma } from "@/lib/db";

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
