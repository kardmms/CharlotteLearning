import "server-only";

import { restrictedFetch } from "@/lib/outbound";

type JsonRecord = Record<string, unknown>;

export type OpenAiUsageMetrics = {
  configured: boolean;
  generatedAt: string;
  message?: string;
  projectId?: string;
  headline: {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    requests: number;
    totalCost: number;
    avgDailyCost: number;
    currency: string;
  };
  days: Array<{
    label: string;
    startTime: number;
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    totalTokens: number;
    requests: number;
    cost: number;
    currency: string;
  }>;
  models: Array<{
    model: string;
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    totalTokens: number;
    requests: number;
  }>;
  costItems: Array<{
    label: string;
    cost: number;
    currency: string;
  }>;
};

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function readNumber(source: JsonRecord, key: string) {
  const value = source[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function readString(source: JsonRecord, key: string, fallback = "") {
  const value = source[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function bucketsFrom(body: unknown) {
  const data = record(body).data;
  return Array.isArray(data) ? data.map(record) : [];
}

async function fetchOpenAiJson(url: URL, adminKey: string) {
  try {
    const response = await restrictedFetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${adminKey}`
      }
    });

    if (!response.ok) {
      return {
        ok: false as const,
        message: `OpenAI API returned ${response.status} for ${url.pathname}.`
      };
    }

    return { ok: true as const, body: await response.json() as unknown };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Could not reach OpenAI."
    };
  }
}

function dayLabel(startTime: number) {
  return new Date(startTime * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

export async function getOpenAiUsageMetrics(): Promise<OpenAiUsageMetrics> {
  const adminKey = process.env.OPENAI_ADMIN_KEY || "";
  const projectId =
    process.env.CHARLOTTE_OPENAI_PROJECT_ID ||
    process.env.OPENAI_USAGE_PROJECT_ID ||
    process.env.OPENAI_PROJECT_ID ||
    "";
  const generatedAt = new Date().toISOString();
  const emptyHeadline = {
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    requests: 0,
    totalCost: 0,
    avgDailyCost: 0,
    currency: "usd"
  };

  if (!adminKey) {
    return {
      configured: false,
      generatedAt,
      message: "Add OPENAI_ADMIN_KEY in production to show organization token usage and costs.",
      projectId: projectId || undefined,
      headline: emptyHeadline,
      days: [],
      models: [],
      costItems: []
    };
  }

  const endTime = Math.floor(Date.now() / 1000);
  const startTime = endTime - (13 * 24 * 60 * 60);
  const usageUrl = new URL("https://api.openai.com/v1/organization/usage/completions");
  usageUrl.searchParams.set("start_time", String(startTime));
  usageUrl.searchParams.set("end_time", String(endTime));
  usageUrl.searchParams.set("bucket_width", "1d");
  usageUrl.searchParams.set("limit", "14");
  usageUrl.searchParams.append("group_by", "model");
  if (projectId) usageUrl.searchParams.append("project_ids", projectId);

  const costsUrl = new URL("https://api.openai.com/v1/organization/costs");
  costsUrl.searchParams.set("start_time", String(startTime));
  costsUrl.searchParams.set("end_time", String(endTime));
  costsUrl.searchParams.set("bucket_width", "1d");
  costsUrl.searchParams.set("limit", "14");
  costsUrl.searchParams.append("group_by", "line_item");
  if (projectId) costsUrl.searchParams.append("project_ids", projectId);

  const [usageResult, costsResult] = await Promise.all([
    fetchOpenAiJson(usageUrl, adminKey),
    fetchOpenAiJson(costsUrl, adminKey)
  ]);
  const messages = [usageResult, costsResult]
    .filter((result): result is { ok: false; message: string } => !result.ok)
    .map((result) => result.message);
  const days = new Map<number, OpenAiUsageMetrics["days"][number]>();
  const models = new Map<string, OpenAiUsageMetrics["models"][number]>();
  const costItems = new Map<string, OpenAiUsageMetrics["costItems"][number]>();

  if (usageResult.ok) {
    for (const bucket of bucketsFrom(usageResult.body)) {
      const bucketStart = readNumber(bucket, "start_time");
      const day = days.get(bucketStart) || {
        label: dayLabel(bucketStart),
        startTime: bucketStart,
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        totalTokens: 0,
        requests: 0,
        cost: 0,
        currency: "usd"
      };
      const results = bucket.results;
      if (Array.isArray(results)) {
        for (const resultValue of results) {
          const result = record(resultValue);
          const modelName = readString(result, "model", "Unspecified");
          const inputTokens = readNumber(result, "input_tokens");
          const outputTokens = readNumber(result, "output_tokens");
          const cachedTokens = readNumber(result, "input_cached_tokens");
          const requests = readNumber(result, "num_model_requests");
          const totalTokens = inputTokens + outputTokens;
          const model = models.get(modelName) || {
            model: modelName,
            inputTokens: 0,
            outputTokens: 0,
            cachedTokens: 0,
            totalTokens: 0,
            requests: 0
          };

          day.inputTokens += inputTokens;
          day.outputTokens += outputTokens;
          day.cachedTokens += cachedTokens;
          day.totalTokens += totalTokens;
          day.requests += requests;
          model.inputTokens += inputTokens;
          model.outputTokens += outputTokens;
          model.cachedTokens += cachedTokens;
          model.totalTokens += totalTokens;
          model.requests += requests;
          models.set(modelName, model);
        }
      }
      days.set(bucketStart, day);
    }
  }

  if (costsResult.ok) {
    for (const bucket of bucketsFrom(costsResult.body)) {
      const bucketStart = readNumber(bucket, "start_time");
      const day = days.get(bucketStart) || {
        label: dayLabel(bucketStart),
        startTime: bucketStart,
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        totalTokens: 0,
        requests: 0,
        cost: 0,
        currency: "usd"
      };
      const results = bucket.results;
      if (Array.isArray(results)) {
        for (const resultValue of results) {
          const result = record(resultValue);
          const amount = record(result.amount);
          const currency = readString(amount, "currency", "usd").toLowerCase();
          const value = readNumber(amount, "value");
          const lineItem = readString(result, "line_item", "OpenAI usage");
          const item = costItems.get(lineItem) || { label: lineItem, cost: 0, currency };

          day.cost += value;
          day.currency = currency;
          item.cost += value;
          item.currency = currency;
          costItems.set(lineItem, item);
        }
      }
      days.set(bucketStart, day);
    }
  }

  const dayRows = [...days.values()].sort((a, b) => a.startTime - b.startTime);
  const modelRows = [...models.values()].sort((a, b) => b.totalTokens - a.totalTokens).slice(0, 8);
  const costRows = [...costItems.values()].sort((a, b) => b.cost - a.cost).slice(0, 8);
  const headline = dayRows.reduce((total, day) => ({
    totalTokens: total.totalTokens + day.totalTokens,
    inputTokens: total.inputTokens + day.inputTokens,
    outputTokens: total.outputTokens + day.outputTokens,
    cachedTokens: total.cachedTokens + day.cachedTokens,
    requests: total.requests + day.requests,
    totalCost: total.totalCost + day.cost,
    avgDailyCost: 0,
    currency: day.currency || total.currency
  }), emptyHeadline);
  headline.avgDailyCost = dayRows.length ? headline.totalCost / dayRows.length : 0;

  return {
    configured: true,
    generatedAt,
    message: messages.join(" "),
    projectId: projectId || undefined,
    headline,
    days: dayRows,
    models: modelRows,
    costItems: costRows
  };
}
