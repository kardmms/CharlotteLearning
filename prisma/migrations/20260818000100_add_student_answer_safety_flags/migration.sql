ALTER TABLE "StudentAnswer"
ADD COLUMN "safetyFlagCategories" TEXT,
ADD COLUMN "safetyFlaggedAt" TIMESTAMP(3);

CREATE INDEX "StudentAnswer_safetyFlaggedAt_idx" ON "StudentAnswer"("safetyFlaggedAt");
