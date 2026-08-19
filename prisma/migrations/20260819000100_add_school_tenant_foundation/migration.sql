-- Add a first-class school tenant layer. Existing pilot data is backfilled into
-- one school workspace per teacher so current accounts continue to work.

CREATE TYPE "SchoolRole" AS ENUM ('OWNER', 'ADMIN', 'TEACHER');

CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "districtName" TEXT,
    "dataRegion" TEXT NOT NULL DEFAULT 'us',
    "encryptionKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SchoolTeacher" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "role" "SchoolRole" NOT NULL DEFAULT 'TEACHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SchoolTeacher_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Teacher" ADD COLUMN "defaultSchoolId" TEXT;
ALTER TABLE "Classroom" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "Student" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "Material" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "Question" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "AtHomeResource" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "StudentSession" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "StudentAnswer" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "GameRoom" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "GameParticipant" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "GameVocabTerm" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "AuditEvent" ADD COLUMN "schoolId" TEXT;
ALTER TABLE "EmailDelivery" ADD COLUMN "schoolId" TEXT;

INSERT INTO "School" ("id", "name", "slug", "createdAt", "updatedAt")
SELECT
  'school_' || "id",
  CASE
    WHEN "isShowcase" THEN 'Showcase Workspace'
    ELSE LEFT("name" || ' School Workspace', 160)
  END,
  'teacher-' || LOWER(SUBSTRING(MD5("email"), 1, 16)),
  "createdAt",
  CURRENT_TIMESTAMP
FROM "Teacher"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "SchoolTeacher" ("id", "schoolId", "teacherId", "role", "createdAt")
SELECT
  'school_teacher_' || "id",
  'school_' || "id",
  "id",
  'OWNER'::"SchoolRole",
  "createdAt"
FROM "Teacher"
ON CONFLICT DO NOTHING;

UPDATE "Teacher"
SET "defaultSchoolId" = 'school_' || "id"
WHERE "defaultSchoolId" IS NULL;

UPDATE "Classroom" c
SET "schoolId" = t."defaultSchoolId"
FROM "Teacher" t
WHERE c."teacherId" = t."id" AND c."schoolId" IS NULL;

UPDATE "Student" s
SET "schoolId" = c."schoolId"
FROM "Classroom" c
WHERE s."classroomId" = c."id" AND s."schoolId" IS NULL;

UPDATE "Material" m
SET "schoolId" = c."schoolId"
FROM "Classroom" c
WHERE m."classroomId" = c."id" AND m."schoolId" IS NULL;

UPDATE "Question" q
SET "schoolId" = m."schoolId"
FROM "Material" m
WHERE q."materialId" = m."id" AND q."schoolId" IS NULL;

UPDATE "AtHomeResource" r
SET "schoolId" = c."schoolId"
FROM "Classroom" c
WHERE r."classroomId" = c."id" AND r."schoolId" IS NULL;

UPDATE "StudentSession" ss
SET "schoolId" = m."schoolId"
FROM "Material" m
WHERE ss."materialId" = m."id" AND ss."schoolId" IS NULL;

UPDATE "StudentAnswer" sa
SET "schoolId" = ss."schoolId"
FROM "StudentSession" ss
WHERE sa."sessionId" = ss."id" AND sa."schoolId" IS NULL;

UPDATE "GameRoom" gr
SET "schoolId" = COALESCE(
  (SELECT c."schoolId" FROM "Classroom" c WHERE c."id" = gr."classroomId"),
  t."defaultSchoolId"
)
FROM "Teacher" t
WHERE gr."teacherId" = t."id" AND gr."schoolId" IS NULL;

UPDATE "GameParticipant" gp
SET "schoolId" = gr."schoolId"
FROM "GameRoom" gr
WHERE gp."roomId" = gr."id" AND gp."schoolId" IS NULL;

UPDATE "GameVocabTerm" gt
SET "schoolId" = gr."schoolId"
FROM "GameRoom" gr
WHERE gt."roomId" = gr."id" AND gt."schoolId" IS NULL;

UPDATE "EmailDelivery" ed
SET "schoolId" = COALESCE(
  (SELECT c."schoolId" FROM "Classroom" c WHERE c."id" = ed."classroomId"),
  (SELECT s."schoolId" FROM "Student" s WHERE s."id" = ed."studentId"),
  (SELECT t."defaultSchoolId" FROM "Teacher" t WHERE t."id" = ed."teacherId")
)
WHERE ed."schoolId" IS NULL;

UPDATE "AuditEvent" ae
SET "schoolId" = COALESCE(
  (SELECT t."defaultSchoolId" FROM "Teacher" t WHERE t."id" = ae."actorId"),
  (SELECT s."schoolId" FROM "Student" s WHERE s."id" = ae."actorId"),
  (SELECT t."defaultSchoolId" FROM "Teacher" t WHERE t."id" = ae."targetId"),
  (SELECT c."schoolId" FROM "Classroom" c WHERE c."id" = ae."targetId"),
  (SELECT m."schoolId" FROM "Material" m WHERE m."id" = ae."targetId"),
  (SELECT q."schoolId" FROM "Question" q WHERE q."id" = ae."targetId"),
  (SELECT ss."schoolId" FROM "StudentSession" ss WHERE ss."id" = ae."targetId"),
  (SELECT sa."schoolId" FROM "StudentAnswer" sa WHERE sa."id" = ae."targetId"),
  (SELECT gr."schoolId" FROM "GameRoom" gr WHERE gr."id" = ae."targetId")
)
WHERE ae."schoolId" IS NULL;

ALTER TABLE "Classroom" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Student" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Material" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Question" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "AtHomeResource" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "StudentSession" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "StudentAnswer" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "GameRoom" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "GameParticipant" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "GameVocabTerm" ALTER COLUMN "schoolId" SET NOT NULL;

CREATE UNIQUE INDEX "School_slug_key" ON "School"("slug");
CREATE INDEX "School_createdAt_idx" ON "School"("createdAt");
CREATE UNIQUE INDEX "SchoolTeacher_schoolId_teacherId_key" ON "SchoolTeacher"("schoolId", "teacherId");
CREATE INDEX "SchoolTeacher_teacherId_schoolId_idx" ON "SchoolTeacher"("teacherId", "schoolId");

CREATE INDEX "Teacher_defaultSchoolId_idx" ON "Teacher"("defaultSchoolId");
CREATE INDEX "Classroom_schoolId_archivedAt_idx" ON "Classroom"("schoolId", "archivedAt");
CREATE INDEX "Classroom_schoolId_teacherId_archivedAt_idx" ON "Classroom"("schoolId", "teacherId", "archivedAt");
CREATE INDEX "Student_schoolId_classroomId_active_idx" ON "Student"("schoolId", "classroomId", "active");
CREATE INDEX "Student_schoolId_accountId_active_idx" ON "Student"("schoolId", "accountId", "active");
CREATE INDEX "Material_schoolId_teacherId_updatedAt_idx" ON "Material"("schoolId", "teacherId", "updatedAt");
CREATE INDEX "Material_schoolId_classroomId_createdAt_idx" ON "Material"("schoolId", "classroomId", "createdAt");
CREATE INDEX "Material_schoolId_classroomId_activityKind_isAdaptiveHome_availableAt_idx" ON "Material"("schoolId", "classroomId", "activityKind", "isAdaptiveHome", "availableAt");
CREATE INDEX "Question_schoolId_materialId_sortOrder_idx" ON "Question"("schoolId", "materialId", "sortOrder");
CREATE INDEX "AtHomeResource_schoolId_classroomId_createdAt_idx" ON "AtHomeResource"("schoolId", "classroomId", "createdAt");
CREATE INDEX "StudentSession_schoolId_materialId_status_completedAt_idx" ON "StudentSession"("schoolId", "materialId", "status", "completedAt");
CREATE INDEX "StudentSession_schoolId_studentId_materialId_status_idx" ON "StudentSession"("schoolId", "studentId", "materialId", "status");
CREATE INDEX "StudentSession_schoolId_lastSeenAt_idx" ON "StudentSession"("schoolId", "lastSeenAt");
CREATE INDEX "StudentAnswer_schoolId_sessionId_idx" ON "StudentAnswer"("schoolId", "sessionId");
CREATE INDEX "StudentAnswer_schoolId_questionId_idx" ON "StudentAnswer"("schoolId", "questionId");
CREATE INDEX "StudentAnswer_schoolId_safetyFlaggedAt_idx" ON "StudentAnswer"("schoolId", "safetyFlaggedAt");
CREATE INDEX "GameRoom_schoolId_teacherId_createdAt_idx" ON "GameRoom"("schoolId", "teacherId", "createdAt");
CREATE INDEX "GameRoom_schoolId_classroomId_createdAt_idx" ON "GameRoom"("schoolId", "classroomId", "createdAt");
CREATE INDEX "GameParticipant_schoolId_roomId_joinedAt_idx" ON "GameParticipant"("schoolId", "roomId", "joinedAt");
CREATE INDEX "GameParticipant_schoolId_roomId_finishRank_idx" ON "GameParticipant"("schoolId", "roomId", "finishRank");
CREATE INDEX "GameVocabTerm_schoolId_roomId_sortOrder_idx" ON "GameVocabTerm"("schoolId", "roomId", "sortOrder");
CREATE INDEX "AuditEvent_schoolId_createdAt_idx" ON "AuditEvent"("schoolId", "createdAt");
CREATE INDEX "EmailDelivery_schoolId_createdAt_idx" ON "EmailDelivery"("schoolId", "createdAt");

ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_defaultSchoolId_fkey" FOREIGN KEY ("defaultSchoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SchoolTeacher" ADD CONSTRAINT "SchoolTeacher_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchoolTeacher" ADD CONSTRAINT "SchoolTeacher_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Material" ADD CONSTRAINT "Material_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Question" ADD CONSTRAINT "Question_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AtHomeResource" ADD CONSTRAINT "AtHomeResource_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentSession" ADD CONSTRAINT "StudentSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentAnswer" ADD CONSTRAINT "StudentAnswer_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameRoom" ADD CONSTRAINT "GameRoom_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameVocabTerm" ADD CONSTRAINT "GameVocabTerm_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
