ALTER TABLE "ContactLead"
ALTER COLUMN "phone" DROP NOT NULL,
ALTER COLUMN "school" DROP NOT NULL;

CREATE INDEX "ContactLead_createdAt_idx" ON "ContactLead"("createdAt");
