export type ShowcaseQuestion = {
  id: string;
  type: "VOCAB" | "COMPREHENSION" | "PREDICTION" | "SHORT_RESPONSE";
  prompt: string;
  choices: string[];
  correctAnswer: string;
  contextExcerpt?: string;
  sourcePage?: string;
  skillTag: string;
  standardCode: string;
  rubric?: string;
  explanation?: string;
  difficulty: number;
};

export type ShowcaseStudent = {
  id: string;
  displayName: string;
  email: string;
};

export const showcaseSteps = [
  "Create a showcase class",
  "Import the roster",
  "Create an AI assignment",
  "Publish the assignment",
  "Run student simulation",
  "Review class stats",
  "Grade free responses",
  "Create a multiple-choice follow-up",
  "Run improvement simulation",
  "Review assignment improvements"
];

export const showcaseStudents: ShowcaseStudent[] = [
  { id: "maya", displayName: "Maya Thompson", email: "maya.thompson@student.demo" },
  { id: "liam", displayName: "Liam Patel", email: "liam.patel@student.demo" },
  { id: "noah", displayName: "Noah Garcia", email: "noah.garcia@student.demo" },
  { id: "ava", displayName: "Ava Johnson", email: "ava.johnson@student.demo" },
  { id: "ethan", displayName: "Ethan Kim", email: "ethan.kim@student.demo" },
  { id: "sofia", displayName: "Sofia Martinez", email: "sofia.martinez@student.demo" },
  { id: "benjamin", displayName: "Benjamin Lee", email: "benjamin.lee@student.demo" },
  { id: "harper", displayName: "Harper Wilson", email: "harper.wilson@student.demo" },
  { id: "olivia", displayName: "Olivia Brown", email: "olivia.brown@student.demo" },
  { id: "mason", displayName: "Mason Davis", email: "mason.davis@student.demo" },
  { id: "amelia", displayName: "Amelia Nguyen", email: "amelia.nguyen@student.demo" },
  { id: "lucas", displayName: "Lucas Robinson", email: "lucas.robinson@student.demo" }
];

export const showcaseQuestions: ShowcaseQuestion[] = [
  {
    id: "q1",
    type: "VOCAB",
    prompt: "What does fragile mean in this part?",
    choices: ["Easy to break", "Very loud", "Full of water", "Hard to find"],
    correctAnswer: "Easy to break",
    contextExcerpt:
      "The class carefully lifted the fragile shell from the tide pool. Its thin edge looked like it could crack if anyone squeezed too hard.",
    sourcePage: "PDF page 1",
    skillTag: "Vocabulary in context",
    standardCode: "L.3.4",
    explanation: "The shell is thin and could crack, so fragile means easy to break.",
    difficulty: 2
  },
  {
    id: "q2",
    type: "COMPREHENSION",
    prompt: "Why did the class move slowly near the tide pool?",
    choices: [
      "They did not want to scare or hurt the animals",
      "They were trying to win a race",
      "They forgot where the bus was parked",
      "They wanted to skip the science lesson"
    ],
    correctAnswer: "They did not want to scare or hurt the animals",
    contextExcerpt:
      "Ms. Rivera asked everyone to take quiet steps. Tiny crabs were hiding under the rocks, and small fish darted through the shallow water.",
    sourcePage: "PDF page 1",
    skillTag: "Close reading",
    standardCode: "RI.3.1",
    explanation: "The class moved slowly because living animals were in the tide pool.",
    difficulty: 2
  },
  {
    id: "q3",
    type: "COMPREHENSION",
    prompt: "Which detail shows that the students were curious?",
    choices: [
      "They asked questions about the crabs",
      "They packed their lunches",
      "They walked back to the bus",
      "They zipped their jackets"
    ],
    correctAnswer: "They asked questions about the crabs",
    contextExcerpt:
      "The students leaned closer, but not too close. Maya raised her hand and asked why the crabs carried bits of seaweed on their backs.",
    sourcePage: "PDF page 2",
    skillTag: "Character actions",
    standardCode: "RL.3.1",
    explanation: "Asking a question is a direct sign that the students wanted to learn more.",
    difficulty: 3
  },
  {
    id: "q4",
    type: "VOCAB",
    prompt: "What does darted mean here?",
    choices: ["Moved quickly", "Slept deeply", "Made music", "Changed color"],
    correctAnswer: "Moved quickly",
    contextExcerpt:
      "When a shadow crossed the water, three small fish darted between the rocks. A moment later, they were hidden again.",
    sourcePage: "PDF page 2",
    skillTag: "Vocabulary in context",
    standardCode: "L.3.4",
    explanation: "The fish disappeared in a moment, so darted means moved quickly.",
    difficulty: 2
  },
  {
    id: "q5",
    type: "SHORT_RESPONSE",
    prompt: "How did Ms. Rivera help the class learn safely?",
    choices: [],
    correctAnswer: "",
    contextExcerpt:
      "Ms. Rivera asked everyone to take quiet steps. She reminded the class to observe with their eyes first and touch only when she said it was safe.",
    sourcePage: "PDF page 3",
    skillTag: "Evidence from text",
    standardCode: "RI.3.1",
    rubric:
      "Strong responses name one safety action from Ms. Rivera and explain how it helped students learn without hurting the tide pool.",
    difficulty: 3
  },
  {
    id: "q6",
    type: "PREDICTION",
    prompt: "What might the class do next? Use one clue.",
    choices: [],
    correctAnswer: "",
    contextExcerpt:
      "Before leaving, Ms. Rivera handed each group a blank observation chart. She pointed to the boxes for animal, habitat, and question.",
    sourcePage: "PDF page 3",
    skillTag: "Prediction with evidence",
    standardCode: "RL.3.1",
    rubric:
      "Strong responses make a reasonable prediction and support it with the observation chart clue.",
    difficulty: 3
  }
];

export const showcaseSimulationMessages = [
  "Handing out the in-class activity...",
  "Students are finding their seats and opening Charlotte...",
  "A few confident hands are already in the air...",
  "Someone is rereading the excerpt before answering...",
  "Charlotte is collecting responses from every student...",
  "Finishing the last submissions and building the teacher view..."
];

export const showcaseGradingMessages = [
  "Grading written responses...",
  "Checking whether students used text evidence...",
  "Separating strong answers from vague ones...",
  "Saving scores for the showcase dashboard..."
];
