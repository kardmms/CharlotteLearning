-- CreateTable
CREATE TABLE "StudentAccount" (
  "id" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentAccount_email_key" ON "StudentAccount"("email");

-- Preserve existing student credentials as global accounts.
INSERT INTO "StudentAccount" ("id", "displayName", "email", "passwordHash", "createdAt")
SELECT DISTINCT ON (LOWER("email"))
  "id",
  "displayName",
  LOWER("email"),
  "passwordHash",
  "createdAt"
FROM "Student"
WHERE "email" IS NOT NULL AND "passwordHash" IS NOT NULL
ORDER BY LOWER("email"), "createdAt" ASC;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN "accountId" TEXT;

UPDATE "Student" AS student
SET "accountId" = account."id"
FROM "StudentAccount" AS account
WHERE LOWER(student."email") = account."email";

ALTER TABLE "Student" DROP COLUMN "passwordHash";

-- Remove enrollment codes. Future live-game codes will use a separate feature.
DROP INDEX IF EXISTS "Classroom_code_key";
ALTER TABLE "Classroom" DROP COLUMN "code";

-- CreateIndex
CREATE INDEX "Student_accountId_active_idx" ON "Student"("accountId", "active");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "StudentAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
