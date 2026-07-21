CREATE TYPE "IdentityMode" AS ENUM ('STANDARD', 'SCHOOL_KEY');

ALTER TABLE "Classroom"
  ADD COLUMN "identityMode" "IdentityMode" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "privacyKeySalt" TEXT,
  ADD COLUMN "privacyKeyVerifier" TEXT,
  ADD COLUMN "privacyKeyHint" TEXT;

ALTER TABLE "Student"
  ADD COLUMN "displayNameEncrypted" TEXT,
  ADD COLUMN "emailEncrypted" TEXT,
  ADD COLUMN "emailKeyHash" TEXT;

ALTER TABLE "StudentAccount"
  ADD COLUMN "emailKeyHash" TEXT,
  ADD COLUMN "displayNameEncrypted" TEXT,
  ADD COLUMN "emailEncrypted" TEXT;

CREATE UNIQUE INDEX "Student_classroomId_emailKeyHash_key" ON "Student"("classroomId", "emailKeyHash");
CREATE UNIQUE INDEX "StudentAccount_emailKeyHash_key" ON "StudentAccount"("emailKeyHash");
