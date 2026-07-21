import "server-only";

import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { hashText } from "@/lib/security";

export class RateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

type RateLimitOptions = {
  scope: string;
  limit: number;
  windowSeconds: number;
  identifier?: string;
};

function firstHeaderIp(value?: string | null) {
  return value?.split(",")[0]?.trim() || "";
}

function safeIdentifier(value: string) {
  return hashText(value.toLowerCase().trim()).slice(0, 48);
}

export async function requestIp() {
  const headerStore = await headers();
  return (
    firstHeaderIp(headerStore.get("cf-connecting-ip")) ||
    firstHeaderIp(headerStore.get("x-real-ip")) ||
    firstHeaderIp(headerStore.get("x-forwarded-for")) ||
    firstHeaderIp(headerStore.get("x-vercel-forwarded-for")) ||
    "unknown"
  );
}

export async function rateLimitIdentity(identifier?: string) {
  return safeIdentifier(identifier || await requestIp());
}

export async function enforceRateLimit({
  scope,
  limit,
  windowSeconds,
  identifier
}: RateLimitOptions) {
  const safeKey = `${scope}:${await rateLimitIdentity(identifier)}`;
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);

  const [bucket] = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "createdAt", "updatedAt")
    VALUES (${safeKey}, 1, ${resetAt}, NOW(), NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${resetAt}
        ELSE "RateLimitBucket"."resetAt"
      END,
      "updatedAt" = NOW()
    RETURNING "count", "resetAt"
  `;

  if (bucket.count <= limit) return;

  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt.getTime() - now.getTime()) / 1000));
  throw new RateLimitError("Too many requests. Please wait a bit and try again.", retryAfterSeconds);
}

export async function clearExpiredRateLimits(sampleRate = 0.01) {
  if (Math.random() > sampleRate) return;
  await prisma.rateLimitBucket.deleteMany({
    where: {
      resetAt: { lt: new Date(Date.now() - 60 * 60 * 1000) }
    }
  });
}
