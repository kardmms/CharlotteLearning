import "server-only";

import { prisma } from "@/lib/db";

function contactLeadRetentionDays() {
  const configured = Number.parseInt(process.env.CONTACT_LEAD_RETENTION_DAYS || "180", 10);
  if (Number.isNaN(configured)) return 180;
  return Math.min(730, Math.max(30, configured));
}

export async function deleteExpiredPrivacyData(now = new Date()) {
  const retentionDays = contactLeadRetentionDays();
  const contactLeadCutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const staleRateLimitCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [contactLeads, rateLimitBuckets] = await prisma.$transaction([
    prisma.contactLead.deleteMany({
      where: { createdAt: { lt: contactLeadCutoff } }
    }),
    prisma.rateLimitBucket.deleteMany({
      where: { resetAt: { lt: staleRateLimitCutoff } }
    })
  ]);

  return {
    contactLeadRetentionDays: retentionDays,
    contactLeadsDeleted: contactLeads.count,
    rateLimitBucketsDeleted: rateLimitBuckets.count
  };
}
