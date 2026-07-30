ALTER TABLE "Teacher"
ADD COLUMN "showcaseCleanupAt" TIMESTAMP(3);

ALTER TABLE "Material"
ADD COLUMN "showcaseSimulationStartedAt" TIMESTAMP(3),
ADD COLUMN "showcaseSimulationCompletedAt" TIMESTAMP(3);

CREATE INDEX "Material_teacherId_showcaseSimulationStartedAt_showcaseSimulationCompletedAt_idx"
ON "Material"("teacherId", "showcaseSimulationStartedAt", "showcaseSimulationCompletedAt");
