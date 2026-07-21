import "server-only";

const defaultAllowedHosts = ["api.openai.com", "challenges.cloudflare.com"];

function allowedOutboundHosts() {
  const configured = process.env.ALLOWED_OUTBOUND_HOSTS;
  const hosts = (configured ? configured.split(",") : defaultAllowedHosts)
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return new Set(hosts);
}

export function assertAllowedOutboundUrl(input: Parameters<typeof fetch>[0]) {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url
  );

  if (url.protocol !== "https:") {
    throw new Error("Blocked outbound request: HTTPS is required.");
  }
  if (!allowedOutboundHosts().has(url.hostname.toLowerCase())) {
    throw new Error("Blocked outbound request: host is not allowed.");
  }
}

export async function restrictedFetch(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1]
) {
  assertAllowedOutboundUrl(input);
  return fetch(input, init);
}
