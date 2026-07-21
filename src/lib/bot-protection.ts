import "server-only";

import crypto from "node:crypto";
import { requestIp } from "@/lib/rate-limit";

type TurnstileResponse = {
  success: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
};

export class BotProtectionError extends Error {
  constructor(message = "Verification failed. Please try again.") {
    super(message);
    this.name = "BotProtectionError";
  }
}

function isRequired() {
  return process.env.TURNSTILE_REQUIRED === "true";
}

function secretKey() {
  return process.env.TURNSTILE_SECRET_KEY || "";
}

export function turnstileSiteKey() {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
}

export function isTurnstileConfigured() {
  return Boolean(turnstileSiteKey() && secretKey());
}

export async function enforceTurnstile(formData: FormData, expectedAction: string) {
  const secret = secretKey();
  if (!secret) {
    if (isRequired()) throw new BotProtectionError("Verification is not configured yet.");
    return;
  }

  const token = String(formData.get("cf-turnstile-response") ?? "");
  if (!token) throw new BotProtectionError();

  const payload = new FormData();
  payload.append("secret", secret);
  payload.append("response", token);
  payload.append("remoteip", await requestIp());
  payload.append("idempotency_key", crypto.randomUUID());

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: payload,
    signal: AbortSignal.timeout(8000)
  });
  const result = await response.json() as TurnstileResponse;

  if (!response.ok || !result.success) {
    throw new BotProtectionError();
  }
  if (result.action && result.action !== expectedAction) {
    throw new BotProtectionError();
  }
}
