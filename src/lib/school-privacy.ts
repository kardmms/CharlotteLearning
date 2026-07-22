import "server-only";

import crypto from "node:crypto";
import { normalizeStudentEmail } from "@/lib/codes";
import { getAuthSecret } from "@/lib/security";

export const SCHOOL_PRIVACY_KEY_MIN_LENGTH = 12;

const CIPHER_PREFIX = "v1";
const CLASS_KEY_CONTEXT = "charlotte-class-identity-v1";
const EMAIL_LOOKUP_CONTEXT = "charlotte-student-email-lookup-v2";
const VERIFIER_MESSAGE = "charlotte-school-held-privacy-key";

export function cleanPrivacyKey(value: string) {
  return value.trim().normalize("NFKC");
}

export function isUsablePrivacyKey(value: string) {
  return cleanPrivacyKey(value).length >= SCHOOL_PRIVACY_KEY_MIN_LENGTH;
}

export function createPrivacyKeySalt() {
  return crypto.randomBytes(16).toString("base64url");
}

export function createClassPrivacyRecoveryKey() {
  return `charlotte-${crypto.randomBytes(18).toString("base64url")}`;
}

export function deriveClassPrivacyKey(rawKey: string, salt: string) {
  return crypto.scryptSync(cleanPrivacyKey(rawKey), `${CLASS_KEY_CONTEXT}:${salt}`, 32);
}

export function privacyKeyVerifierFromDerivedKey(derivedKey: Buffer) {
  return crypto.createHmac("sha256", derivedKey).update(VERIFIER_MESSAGE).digest("base64url");
}

export function verifyClassPrivacyKey(rawKey: string, salt?: string | null, verifier?: string | null) {
  if (!salt || !verifier || !isUsablePrivacyKey(rawKey)) return false;
  const derivedKey = deriveClassPrivacyKey(rawKey, salt);
  const expected = privacyKeyVerifierFromDerivedKey(derivedKey);
  const expectedBuffer = Buffer.from(expected);
  const verifierBuffer = Buffer.from(verifier);
  return (
    expectedBuffer.length === verifierBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, verifierBuffer)
  );
}

export function emailKeyHashForPrivacyKey(rawKey: string, email: string) {
  const normalizedEmail = normalizeStudentEmail(email).slice(0, 254);
  const lookupKey = crypto.scryptSync(cleanPrivacyKey(rawKey), EMAIL_LOOKUP_CONTEXT, 32);
  return crypto.createHmac("sha256", lookupKey).update(normalizedEmail).digest("base64url");
}

export function studentEmailLookupHash(email: string) {
  const normalizedEmail = normalizeStudentEmail(email).slice(0, 254);
  const lookupKey = crypto.createHmac("sha256", getAuthSecret()).update(EMAIL_LOOKUP_CONTEXT).digest();
  return crypto.createHmac("sha256", lookupKey).update(normalizedEmail).digest("base64url");
}

export function privacyAccountEmail(emailKeyHash: string) {
  return `privacy-${emailKeyHash.slice(0, 32)}@students.charlotte.local`;
}

export function encryptIdentityValue(value: string, derivedKey: Buffer) {
  const cleaned = value.trim();
  if (!cleaned) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(cleaned, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    CIPHER_PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url")
  ].join(".");
}

export function decryptIdentityValue(payload: string, derivedKey: Buffer) {
  const [version, iv, tag, encrypted] = payload.split(".");
  if (version !== CIPHER_PREFIX || !iv || !tag || !encrypted) {
    throw new Error("Unsupported encrypted identity format.");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    derivedKey,
    Buffer.from(iv, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final()
  ]).toString("utf8");
}
