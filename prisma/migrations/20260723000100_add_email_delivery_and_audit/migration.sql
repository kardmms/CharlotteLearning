CREATE TYPE "EmailKind" AS ENUM (
  'TEACHER_WELCOME',
  'STUDENT_ENROLLMENT',
  'WEEKLY_TEACHER_SUMMARY'
);

CREATE TYPE "EmailDeliveryStatus" AS ENUM (
  'PENDING',
  'SENT',
  'FAILED',
  'SKIPPED'
);

ALTER TABLE "Teacher"
ADD COLUMN "weeklySummaryEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL,
  "actorType" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailDelivery" (
  "id" TEXT NOT NULL,
  "kind" "EmailKind" NOT NULL,
  "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "recipientHash" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "teacherId" TEXT,
  "studentId" TEXT,
  "classroomId" TEXT,
  "periodStart" TIMESTAMP(3),
  "providerMessageId" TEXT,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),

  CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");
CREATE INDEX "AuditEvent_actorType_actorId_createdAt_idx" ON "AuditEvent"("actorType", "actorId", "createdAt");
CREATE INDEX "AuditEvent_targetType_targetId_createdAt_idx" ON "AuditEvent"("targetType", "targetId", "createdAt");
CREATE UNIQUE INDEX "EmailDelivery_kind_teacherId_periodStart_key" ON "EmailDelivery"("kind", "teacherId", "periodStart");
CREATE INDEX "EmailDelivery_status_createdAt_idx" ON "EmailDelivery"("status", "createdAt");
CREATE INDEX "EmailDelivery_teacherId_createdAt_idx" ON "EmailDelivery"("teacherId", "createdAt");
CREATE INDEX "EmailDelivery_classroomId_createdAt_idx" ON "EmailDelivery"("classroomId", "createdAt");

ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_classroomId_fkey"
  FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
