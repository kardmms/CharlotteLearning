const deploymentEnvironment = process.env.VERCEL_ENV || process.env.DEPLOYMENT_ENV || "";
const databaseEnvironment = process.env.DATABASE_ENVIRONMENT || "";

if (
  (deploymentEnvironment === "preview" || deploymentEnvironment === "development") &&
  databaseEnvironment === "production"
) {
  throw new Error("Preview/development is configured with a production-labeled database.");
}

if (deploymentEnvironment !== "production") {
  console.log("Production readiness check skipped outside the production deployment environment.");
  process.exit(0);
}

const required = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "CRON_SECRET",
  "NEXT_PUBLIC_SITE_URL",
  "RESEND_API_KEY",
  "EMAIL_FROM"
];
const missing = required.filter((name) => !process.env[name]?.trim());

if (databaseEnvironment !== "production") {
  missing.push("DATABASE_ENVIRONMENT=production");
}
if (process.env.DATABASE_BACKUPS_CONFIRMED !== "true") {
  missing.push("DATABASE_BACKUPS_CONFIRMED=true");
}
if (process.env.EMAIL_DELIVERY_ENABLED !== "true") {
  missing.push("EMAIL_DELIVERY_ENABLED=true");
}
if (process.env.TURNSTILE_REQUIRED !== "true") {
  missing.push("TURNSTILE_REQUIRED=true");
}
for (const name of ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"]) {
  if (!process.env[name]?.trim()) missing.push(name);
}
if (!process.env.OPENAI_API_KEY?.trim() && !process.env.OPEN_AI_KEY?.trim()) {
  missing.push("OPENAI_API_KEY or OPEN_AI_KEY");
}
if ((process.env.AUTH_SECRET || "").length < 32) {
  missing.push("AUTH_SECRET (at least 32 characters)");
}
if ((process.env.CRON_SECRET || "").length < 16) {
  missing.push("CRON_SECRET (at least 16 characters)");
}
if ((process.env.NEXT_PUBLIC_SITE_URL || "").includes("example.com")) {
  missing.push("NEXT_PUBLIC_SITE_URL must be the real production URL");
}
if (
  process.env.OPENAI_STUDENT_PII_TO_AI_ENABLED === "true" &&
  process.env.OPENAI_ZERO_DATA_RETENTION_CONFIRMED !== "true"
) {
  missing.push("OPENAI_ZERO_DATA_RETENTION_CONFIRMED=true when OPENAI_STUDENT_PII_TO_AI_ENABLED=true");
}

const configuredHosts = (process.env.ALLOWED_OUTBOUND_HOSTS || "")
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);
if (configuredHosts.length) {
  for (const host of ["api.openai.com", "api.resend.com", "nces.ed.gov"]) {
    if (!configuredHosts.includes(host)) missing.push(`ALLOWED_OUTBOUND_HOSTS must include ${host}`);
  }
}

if (missing.length) {
  throw new Error(`Production readiness check failed:\n- ${[...new Set(missing)].join("\n- ")}`);
}

console.log("Production readiness checks passed.");
