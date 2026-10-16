CREATE TABLE "FinanceEntry" (
  "id" TEXT NOT NULL,
  "externalKey" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "voidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinanceEntry_kind_check" CHECK ("kind" IN ('revenue', 'expense')),
  CONSTRAINT "FinanceEntry_category_check" CHECK ("category" IN ('OpenAI', 'ElevenLabs', 'Vercel', 'Stripe', 'Database', 'Email', 'Domains', 'Other'))
);
CREATE UNIQUE INDEX "FinanceEntry_externalKey_key" ON "FinanceEntry"("externalKey");
CREATE INDEX "FinanceEntry_occurredAt_voidedAt_idx" ON "FinanceEntry"("occurredAt", "voidedAt");
CREATE INDEX "FinanceEntry_source_occurredAt_idx" ON "FinanceEntry"("source", "occurredAt");
