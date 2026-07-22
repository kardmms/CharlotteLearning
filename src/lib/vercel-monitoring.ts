import "server-only";

import { restrictedFetch } from "@/lib/outbound";

type JsonRecord = Record<string, unknown>;

export type VercelServerMetrics = {
  configured: boolean;
  generatedAt: string;
  message?: string;
  projectId?: string;
  teamId?: string;
  headline: {
    events: number;
    deployments: number;
    readyDeployments: number;
    failedDeployments: number;
    productionDeployments: number;
  };
  events: Array<{
    id: string;
    type: string;
    text: string;
    createdAt: string;
    actor: string;
    category: string;
  }>;
  deployments: Array<{
    id: string;
    url: string;
    state: string;
    readyState: string;
    target: string;
    creator: string;
    createdAt: string;
    readyAt?: string;
    source: string;
  }>;
};

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function readString(source: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function readNumber(source: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function dateFrom(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value > 10_000_000_000 ? value : value * 1000;
    return new Date(milliseconds).toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return dateFrom(numeric);
  }
  return new Date(0).toISOString();
}

function pickArray(body: unknown, keys: string[]) {
  const root = record(body);
  for (const key of keys) {
    const value = root[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function categoryFor(type: string) {
  const lower = type.toLowerCase();
  if (lower.includes("deployment")) return "Deployment";
  if (lower.includes("project")) return "Project";
  if (lower.includes("domain")) return "Domain";
  if (lower.includes("team")) return "Team";
  if (lower.includes("login") || lower.includes("auth")) return "Access";
  return "Activity";
}

function humanizeType(type: string) {
  return type
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Vercel activity";
}

async function fetchVercelJson(url: URL, token: string) {
  try {
    const response = await restrictedFetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      return {
        ok: false as const,
        message: `Vercel API returned ${response.status} for ${url.pathname}.`
      };
    }

    return { ok: true as const, body: await response.json() as unknown };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Could not reach Vercel."
    };
  }
}

function normalizeEvent(item: unknown, index: number) {
  const row = record(item);
  const payload = record(row.payload);
  const user = record(row.user);
  const actor = record(row.actor);
  const payloadUser = record(payload.user);
  const type = readString(row, ["type", "event", "action"]) || "activity";
  const createdAt = dateFrom(
    row.createdAt ?? row.created_at ?? row.created ?? row.date ?? payload.createdAt ?? payload.created
  );
  const actorName =
    readString(user, ["name", "username", "email", "uid"]) ||
    readString(actor, ["name", "username", "email", "uid"]) ||
    readString(payloadUser, ["name", "username", "email", "uid"]) ||
    readString(row, ["userId", "actorId"]) ||
    "Vercel";
  const text =
    readString(row, ["text", "message", "title", "description"]) ||
    readString(payload, ["text", "message", "name", "projectName", "deploymentUrl"]) ||
    humanizeType(type);

  return {
    id: readString(row, ["id", "uid"]) || `${type}-${createdAt}-${index}`,
    type,
    text,
    createdAt,
    actor: actorName,
    category: categoryFor(type)
  };
}

function normalizeDeployment(item: unknown, index: number) {
  const row = record(item);
  const creator = record(row.creator);
  const meta = record(row.meta);
  const gitSource = record(row.gitSource);
  const state = readString(row, ["state"]) || "UNKNOWN";
  const readyState = readString(row, ["readyState"]) || state;
  const createdAt = dateFrom(row.createdAt ?? row.created ?? row.created_at);
  const readyAtValue = row.readyAt ?? row.ready ?? row.ready_at;
  const rawUrl = readString(row, ["url"]);
  const branch = readString(meta, ["githubCommitRef"]) || readString(gitSource, ["ref"]);
  const sha = readString(meta, ["githubCommitSha", "commitSha", "gitCommitSha"]);

  return {
    id: readString(row, ["id", "uid"]) || `deployment-${createdAt}-${index}`,
    url: rawUrl ? (rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`) : "Not assigned yet",
    state,
    readyState,
    target: readString(row, ["target"]) || "preview",
    creator: readString(creator, ["name", "username", "email", "uid"]) || "Vercel",
    createdAt,
    readyAt: readyAtValue ? dateFrom(readyAtValue) : undefined,
    source: [branch, sha ? sha.slice(0, 7) : ""].filter(Boolean).join(" @ ") || "Dashboard or CLI"
  };
}

export async function getVercelServerMetrics(): Promise<VercelServerMetrics> {
  const token = process.env.VERCEL_API_TOKEN || process.env.VERCEL_TOKEN || process.env.VERCEL_ACCESS_TOKEN || "";
  const teamId = process.env.CHARLOTTE_VERCEL_TEAM_ID || process.env.VERCEL_TEAM_ID || "";
  const projectId = process.env.CHARLOTTE_VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_ID || "";
  const generatedAt = new Date().toISOString();

  const empty = {
    events: 0,
    deployments: 0,
    readyDeployments: 0,
    failedDeployments: 0,
    productionDeployments: 0
  };

  if (!token) {
    return {
      configured: false,
      generatedAt,
      message: "Add VERCEL_API_TOKEN in production to show live Vercel activity.",
      projectId: projectId || undefined,
      teamId: teamId || undefined,
      headline: empty,
      events: [],
      deployments: []
    };
  }

  const eventsUrl = new URL("https://api.vercel.com/v3/events");
  eventsUrl.searchParams.set("limit", "30");
  eventsUrl.searchParams.set("withPayload", "true");
  if (teamId) eventsUrl.searchParams.set("teamId", teamId);
  if (projectId) eventsUrl.searchParams.append("projectIds", projectId);

  const deploymentsUrl = new URL("https://api.vercel.com/v7/deployments");
  deploymentsUrl.searchParams.set("limit", "12");
  if (teamId) deploymentsUrl.searchParams.set("teamId", teamId);
  if (projectId) deploymentsUrl.searchParams.set("projectId", projectId);

  const [eventsResult, deploymentsResult] = await Promise.all([
    fetchVercelJson(eventsUrl, token),
    fetchVercelJson(deploymentsUrl, token)
  ]);

  const messages = [eventsResult, deploymentsResult]
    .filter((result): result is { ok: false; message: string } => !result.ok)
    .map((result) => result.message);
  const events = eventsResult.ok
    ? pickArray(eventsResult.body, ["events", "data"]).slice(0, 30).map(normalizeEvent)
    : [];
  const deployments = deploymentsResult.ok
    ? pickArray(deploymentsResult.body, ["deployments", "data"]).slice(0, 12).map(normalizeDeployment)
    : [];
  const failedDeployments = deployments.filter((deployment) =>
    `${deployment.state} ${deployment.readyState}`.toLowerCase().match(/error|fail|cancel/)
  ).length;

  return {
    configured: true,
    generatedAt,
    message: messages.join(" "),
    projectId: projectId || undefined,
    teamId: teamId || undefined,
    headline: {
      events: events.length,
      deployments: deployments.length,
      readyDeployments: deployments.filter((deployment) => deployment.readyState.toUpperCase() === "READY").length,
      failedDeployments,
      productionDeployments: deployments.filter((deployment) => deployment.target.toLowerCase() === "production").length
    },
    events,
    deployments
  };
}
