import "server-only";

import standardsData from "@/data/ca-ccss-ela-pages.json";

type StandardsPage = { page: number; text: string };

const pageMap = new Map(
  (standardsData.pages as StandardsPage[]).map((page) => [page.page, page.text])
);

function numericGrade(gradeLevel: string) {
  if (gradeLevel.toUpperCase() === "K") return 0;
  const parsed = Number.parseInt(gradeLevel, 10);
  return Number.isFinite(parsed) ? Math.min(12, Math.max(0, parsed)) : 0;
}

function pagesForGrade(grade: number) {
  if (grade <= 2) return [17, 18, 20, 21, 27, 28, 38, 39, 40];
  if (grade <= 5) return [18, 19, 21, 22, 29, 30, 31, 41, 42, 43, 44];
  if (grade <= 8) return [53, 54, 57, 58, 62, 63, 64, 65, 77, 78];
  return [55, 56, 59, 60, 66, 67, 68, 69, 70, 79, 80, 81];
}

export function standardsReferenceForGrade(gradeLevel: string) {
  const grade = numericGrade(gradeLevel);
  const target = grade === 0 ? "Kindergarten" : `Grade ${grade}`;
  const excerpts = pagesForGrade(grade)
    .map((page) => {
      const text = pageMap.get(page);
      return text ? `[CA CCSS PDF page ${page}]\n${text}` : "";
    })
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 22000);

  return [
    `Target class: ${target}.`,
    "Use only the target grade column or grade band in the excerpts below.",
    "Align each question to one relevant California CCSS ELA/Literacy standard and return its code (for example RL.3.1, RI.6.4, or W.9-10.9).",
    "Do not claim alignment to a standard that the question does not actually assess.",
    excerpts
  ].join("\n\n");
}
