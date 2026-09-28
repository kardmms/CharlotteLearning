CREATE TABLE "TeacherLicense" (
    "teacherId" TEXT NOT NULL,
    "keyHash" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "checkoutSessionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "seats" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeacherLicense_pkey" PRIMARY KEY ("teacherId")
);

CREATE TABLE "StudentLicense" (
    "teacherId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentLicense_pkey" PRIMARY KEY ("teacherId","accountId")
);

CREATE UNIQUE INDEX "TeacherLicense_keyHash_key" ON "TeacherLicense"("keyHash");
CREATE UNIQUE INDEX "TeacherLicense_stripeCustomerId_key" ON "TeacherLicense"("stripeCustomerId");
CREATE UNIQUE INDEX "TeacherLicense_stripeSubscriptionId_key" ON "TeacherLicense"("stripeSubscriptionId");
CREATE INDEX "StudentLicense_accountId_idx" ON "StudentLicense"("accountId");
ALTER TABLE "TeacherLicense" ADD CONSTRAINT "TeacherLicense_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentLicense" ADD CONSTRAINT "StudentLicense_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherLicense"("teacherId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentLicense" ADD CONSTRAINT "StudentLicense_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "StudentAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
