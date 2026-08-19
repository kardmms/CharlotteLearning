import "server-only";

import { prisma } from "@/lib/db";

export type AuditEventInput = {
  schoolId?: string | null;
  actorType: "teacher" | "student" | "admin" | "system";
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

export function auditEventData(input: AuditEventInput) {
  return {
    schoolId: input.schoolId || null,
    actorType: input.actorType,
    actorId: input.actorId || null,
    action: input.action.slice(0, 120),
    targetType: input.targetType.slice(0, 120),
    targetId: input.targetId || null,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null
  };
}

export async function recordAuditEvent(input: AuditEventInput) {
  return prisma.auditEvent.create({ data: auditEventData(input) });
}
