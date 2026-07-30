ALTER TABLE "Teacher"
ADD COLUMN "isShowcase" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "showcaseExpiresAt" TIMESTAMP(3),
ADD COLUMN "showcaseNextTickAt" TIMESTAMP(3);

CREATE INDEX "Teacher_isShowcase_showcaseExpiresAt_idx"
ON "Teacher"("isShowcase", "showcaseExpiresAt");
