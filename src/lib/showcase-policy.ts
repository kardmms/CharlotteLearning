export const SHOWCASE_LIFETIME_MS = 60 * 60 * 1000;

export function effectiveShowcaseExpiry(createdAt: Date, configuredExpiry?: Date | null) {
  const hardExpiry = new Date(createdAt.getTime() + SHOWCASE_LIFETIME_MS);
  return configuredExpiry && configuredExpiry < hardExpiry ? configuredExpiry : hardExpiry;
}

export function isShowcaseExpired(
  createdAt: Date,
  configuredExpiry: Date | null | undefined,
  now = new Date()
) {
  return effectiveShowcaseExpiry(createdAt, configuredExpiry) <= now;
}
