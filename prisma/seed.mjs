import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const teacher = await prisma.teacher.upsert({
    where: { email: "teacher@example.com" },
    update: {},
    create: {
      name: "Demo Teacher",
      email: "teacher@example.com",
      passwordHash: await bcrypt.hash("Charlotte14!", 12)
    }
  });

  let classroom = await prisma.classroom.findFirst({
    where: { teacherId: teacher.id, name: "Demo Literacy Class" }
  });
  if (!classroom) {
    classroom = await prisma.classroom.create({
      data: {
      name: "Demo Literacy Class",
      gradeLevel: "3",
      teacherId: teacher.id
      }
    });
  }

  const students = [
    ["Abigail Walker", "abigail.walker@example.com"],
    ["Aiden Brown", "aiden.brown@example.com"],
    ["Amelia Jackson", "amelia.jackson@example.com"],
    ["Ari Johnson", "ari@example.com"],
    ["Ava Thompson", "ava.thompson@example.com"],
    ["Benjamin Lewis", "benjamin.lewis@example.com"],
    ["Charlotte Allen", "charlotte.allen@example.com"],
    ["Daniel Young", "daniel.young@example.com"],
    ["Elijah Thomas", "elijah.thomas@example.com"],
    ["Emma Wilson", "emma.wilson@example.com"],
    ["Ethan Brooks", "ethan@example.com"],
    ["Evelyn Clark", "evelyn.clark@example.com"],
    ["Grace King", "grace.king@example.com"],
    ["Harper Harris", "harper.harris@example.com"],
    ["Henry Hall", "henry.hall@example.com"],
    ["Isabella Davis", "isabella.davis@example.com"],
    ["Jackson Miller", "jackson.miller@example.com"],
    ["James Martin", "james.martin@example.com"],
    ["Lily Chen", "lily@example.com"],
    ["Logan White", "logan.white@example.com"],
    ["Lucas Martinez", "lucas.martinez@example.com"],
    ["Marcus Reed", "marcus@example.com"],
    ["Mason Taylor", "mason.taylor@example.com"],
    ["Mia Lee", "mia@example.com"],
    ["Noah Patel", "noah@example.com"],
    ["Olivia Anderson", "olivia.anderson@example.com"],
    ["Priya Shah", "priya@example.com"],
    ["Samuel Wright", "samuel.wright@example.com"],
    ["Sofia Garcia", "sofia@example.com"],
    ["Sophia Moore", "sophia.moore@example.com"]
  ];

  const studentPasswordHash = await bcrypt.hash("Charlotte14!", 12);

  for (const [displayName, email] of students) {
    const account = await prisma.studentAccount.upsert({
      where: { email },
      update: {},
      create: { displayName, email, passwordHash: studentPasswordHash }
    });
    await prisma.student.upsert({
      where: {
        classroomId_displayName: {
          classroomId: classroom.id,
          displayName
        }
      },
      update: { email, accountId: account.id },
      create: {
        classroomId: classroom.id,
        accountId: account.id,
        displayName,
        email
      }
    });
  }

  const existingMaterial = await prisma.material.findFirst({
    where: { classroomId: classroom.id, title: "The Wild Robot Escapes - Chapter 1 Demo" }
  });

  if (!existingMaterial) {
    await prisma.material.create({
      data: {
        teacherId: teacher.id,
        classroomId: classroom.id,
        title: "The Wild Robot Escapes - Chapter 1 Demo",
        sourceName: "Charlotte14_Wild_Robot_Escapes_Ch1-10_Workbook.xlsx",
        gradeLevel: "3",
        estimatedMinutes: 15,
        status: "PUBLISHED",
        generationNotes:
          "Seeded demo based on the provided workbook structure. Replace with uploaded material for live use.",
        questions: {
          create: [
            {
              type: "VOCAB",
              prompt:
                "In the story setup, why does the word automated matter when describing Roz's new world?",
              choicesJson: JSON.stringify([
                "It shows machines can do work by themselves",
                "It means the farm is empty",
                "It means Roz forgot her job",
                "It shows the setting is underwater"
              ]),
              correctAnswer: "It shows machines can do work by themselves",
              rubric: "",
              skillTag: "Vocabulary in context",
              difficulty: 3,
              randomizeChoices: true,
              sortOrder: 1
            },
            {
              type: "VOCAB",
              prompt: "Which detail best matches the meaning of landscape?",
              choicesJson: JSON.stringify([
                "The land and scenery around a character",
                "A machine's battery level",
                "A character's private thought",
                "The answer key for a chapter"
              ]),
              correctAnswer: "The land and scenery around a character",
              rubric: "",
              skillTag: "Vocabulary precision",
              difficulty: 2,
              randomizeChoices: true,
              sortOrder: 2
            },
            {
              type: "VOCAB",
              prompt:
                "If traffic is part of Roz's surroundings, what must she pay close attention to?",
              choicesJson: JSON.stringify([
                "Cars and trucks moving on roads",
                "Only birds in trees",
                "A quiet island beach",
                "A vocabulary notebook"
              ]),
              correctAnswer: "Cars and trucks moving on roads",
              rubric: "",
              skillTag: "Context clues",
              difficulty: 2,
              randomizeChoices: true,
              sortOrder: 3
            },
            {
              type: "COMPREHENSION",
              prompt: "Why does Roz have to leave the island?",
              choicesJson: JSON.stringify([
                "She is being moved into a human-controlled setting",
                "She wants to stop helping animals",
                "The island disappears",
                "She chooses to live in traffic"
              ]),
              correctAnswer: "She is being moved into a human-controlled setting",
              rubric: "",
              skillTag: "Cause and effect",
              difficulty: 4,
              randomizeChoices: true,
              sortOrder: 4
            },
            {
              type: "COMPREHENSION",
              prompt:
                "Which feeling is most reasonable for Roz as she leaves, and why would that fit the situation?",
              choicesJson: JSON.stringify([
                "Worried, because she is separated from a familiar home",
                "Bored, because nothing is changing",
                "Proud, because she won a contest",
                "Angry, because she dislikes all animals"
              ]),
              correctAnswer: "Worried, because she is separated from a familiar home",
              rubric: "",
              skillTag: "Character inference",
              difficulty: 4,
              randomizeChoices: true,
              sortOrder: 5
            },
            {
              type: "COMPREHENSION",
              prompt:
                "What is the strongest reason this chapter is a setup for later problems?",
              choicesJson: JSON.stringify([
                "Roz is entering a place with new rules and dangers",
                "The vocabulary words are short",
                "The reader already knows the ending",
                "There are no changes for Roz"
              ]),
              correctAnswer: "Roz is entering a place with new rules and dangers",
              rubric: "",
              skillTag: "Plot setup",
              difficulty: 4,
              randomizeChoices: true,
              sortOrder: 6
            },
            {
              type: "PREDICTION",
              prompt:
                "What problem is most likely to affect Roz next? Use one detail from the chapter setup to support your prediction.",
              choicesJson: null,
              correctAnswer: null,
              rubric:
                "Strong answers make a plausible prediction and connect it to the changed setting or Roz's separation from home.",
              skillTag: "Prediction with evidence",
              difficulty: 4,
              sortOrder: 7
            },
            {
              type: "SHORT_RESPONSE",
              prompt:
                "Explain one way Roz's new setting could change how she solves problems. Use evidence from the chapter idea.",
              choicesJson: null,
              correctAnswer: null,
              rubric:
                "Strong answers name a setting change, explain how it affects problem-solving, and include evidence.",
              skillTag: "Evidence response",
              difficulty: 5,
              sortOrder: 8
            }
          ]
        }
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
