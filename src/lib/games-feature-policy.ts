export function isGamesFeatureEnabled(
  environment: Record<string, string | undefined>,
  now = Date.now()
) {
  const hosted = Boolean(environment.VERCEL_ENV || environment.DEPLOYMENT_ENV)
    || environment.DATABASE_ENVIRONMENT === "production";
  if (hosted && environment.GAMES_FEATURE_EXPIRES_AT) {
    const expiresAt = Date.parse(environment.GAMES_FEATURE_EXPIRES_AT);
    if (!Number.isFinite(expiresAt) || now >= expiresAt) return false;
  }
  if (environment.GAMES_FEATURE_ENABLED === "true") return true;
  if (environment.GAMES_FEATURE_ENABLED === "false") return false;
  return !hosted;
}
