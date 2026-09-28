import { createHmac } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { getAuthSecret } from "./security.ts";

export function billingEnabled() {
  return process.env.SUBSCRIPTIONS_ENABLED === "true";
}

export function licenseKeyHash(key: string) {
  return createHmac("sha256", getAuthSecret()).update(key.trim().toUpperCase()).digest("hex");
}

export class LicenseError extends Error {}

export async function redeemLicense(
  transaction: Prisma.TransactionClient,
  accountId: string,
  key: string,
  teacherId?: string
) {
  const license = await transaction.teacherLicense.findUnique({
    where: { keyHash: licenseKeyHash(key) },
    include: { _count: { select: { redemptions: true } } }
  });
  if (!license || license.status !== "active" || (teacherId && license.teacherId !== teacherId)) {
    throw new LicenseError("Enter an active license key from your teacher.");
  }
  const enrollment = await transaction.student.findFirst({
    where: { accountId, active: true, classroom: { teacherId: license.teacherId, archivedAt: null } },
    select: { id: true }
  });
  if (!enrollment) throw new LicenseError("This key does not match one of your classes.");
  const existing = await transaction.studentLicense.findUnique({
    where: { teacherId_accountId: { teacherId: license.teacherId, accountId } }
  });
  if (existing) {
    if (!existing.active) throw new LicenseError("Your teacher needs to add another student seat.");
    return;
  }
  if (license._count.redemptions >= license.seats) {
    throw new LicenseError("Your teacher has used all licensed student seats.");
  }
  await transaction.studentLicense.create({ data: { teacherId: license.teacherId, accountId } });
}
