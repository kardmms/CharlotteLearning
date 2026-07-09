import crypto from "node:crypto";

export function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 32) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be set to at least 32 characters in production.");
  }

  return "charlotte-dev-secret-change-before-production-32";
}

export function hashText(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export function sanitizeCsvCell(value: unknown) {
  const text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) return `'${text}`;
  return text.replace(/\r?\n/g, " ").trim();
}

export function toCsv(rows: unknown[][]) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const safe = sanitizeCsvCell(cell);
          return `"${safe.replace(/"/g, '""')}"`;
        })
        .join(",")
    )
    .join("\n");
}

export function assertSameOrigin(request: Request) {
  if (request.method === "GET" || request.method === "HEAD") return;

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return;

  const originHost = new URL(origin).host;
  if (originHost !== host) {
    throw new Error("Blocked cross-origin request.");
  }
}
