CREATE TYPE "AdminRole" AS ENUM ('OWNER', 'ADMIN');

CREATE TABLE "AdminUser" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminInvite" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "tokenHash" TEXT NOT NULL,
  "invitedById" TEXT NOT NULL,
  "createdAdminId" TEXT,
  "sentAt" TIMESTAMP(3),
  "usedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminInvite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminSetting" (
  "key" TEXT NOT NULL,
  "value" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AdminSetting_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "TeacherFeedback" (
  "id" TEXT NOT NULL,
  "teacherName" TEXT NOT NULL,
  "teacherEmail" TEXT,
  "schoolOrClass" TEXT,
  "weekOf" TEXT,
  "rating" INTEGER NOT NULL,
  "strengths" TEXT NOT NULL,
  "struggles" TEXT NOT NULL,
  "improvements" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TeacherFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");
CREATE UNIQUE INDEX "AdminInvite_tokenHash_key" ON "AdminInvite"("tokenHash");
CREATE INDEX "AdminInvite_email_createdAt_idx" ON "AdminInvite"("email", "createdAt");
CREATE INDEX "AdminInvite_expiresAt_usedAt_idx" ON "AdminInvite"("expiresAt", "usedAt");
CREATE INDEX "TeacherFeedback_createdAt_idx" ON "TeacherFeedback"("createdAt");
CREATE INDEX "TeacherFeedback_teacherEmail_idx" ON "TeacherFeedback"("teacherEmail");

ALTER TABLE "AdminInvite" ADD CONSTRAINT "AdminInvite_invitedById_fkey"
  FOREIGN KEY ("invitedById") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminInvite" ADD CONSTRAINT "AdminInvite_createdAdminId_fkey"
  FOREIGN KEY ("createdAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
