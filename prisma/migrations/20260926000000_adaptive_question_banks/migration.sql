CREATE TYPE "QuestionCategory" AS ENUM ('UNDERSTANDING', 'EVIDENCE', 'THINKING_DEEPER', 'LANGUAGE', 'WRITTEN_ANALYSIS');

ALTER TABLE "Material" ADD COLUMN "adaptiveQuestionSet" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Question" ADD COLUMN "category" "QuestionCategory";
ALTER TABLE "StudentSession" ADD COLUMN "assignedQuestionIdsJson" TEXT;

CREATE TABLE "StudentCategoryRank" (
  "studentId" TEXT NOT NULL,
  "category" "QuestionCategory" NOT NULL,
  "level" INTEGER NOT NULL DEFAULT 3,
  "assessedCount" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentCategoryRank_pkey" PRIMARY KEY ("studentId", "category")
);

CREATE INDEX "Question_materialId_category_difficulty_idx" ON "Question"("materialId", "category", "difficulty");
ALTER TABLE "StudentCategoryRank" ADD CONSTRAINT "StudentCategoryRank_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
