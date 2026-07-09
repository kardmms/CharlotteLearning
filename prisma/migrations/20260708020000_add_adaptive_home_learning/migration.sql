-- AlterTable
ALTER TABLE "Material"
ADD COLUMN "sourceText" TEXT,
ADD COLUMN "isAdaptiveHome" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "targetStudentId" TEXT;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN "explanation" TEXT;

-- CreateTable
CREATE TABLE "AtHomeResource" (
  "id" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "classroomId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "sourceName" TEXT NOT NULL,
  "sourceHash" TEXT NOT NULL,
  "sourcePreview" TEXT,
  "sourceText" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AtHomeResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Material_classroomId_activityKind_isAdaptiveHome_availableAt_idx"
ON "Material"("classroomId", "activityKind", "isAdaptiveHome", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "Material_targetStudentId_seriesKey_key" ON "Material"("targetStudentId", "seriesKey");

-- CreateIndex
CREATE UNIQUE INDEX "AtHomeResource_classroomId_sourceHash_key"
ON "AtHomeResource"("classroomId", "sourceHash");

-- CreateIndex
CREATE INDEX "AtHomeResource_classroomId_createdAt_idx" ON "AtHomeResource"("classroomId", "createdAt");

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_targetStudentId_fkey"
FOREIGN KEY ("targetStudentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtHomeResource" ADD CONSTRAINT "AtHomeResource_teacherId_fkey"
FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtHomeResource" ADD CONSTRAINT "AtHomeResource_classroomId_fkey"
FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
