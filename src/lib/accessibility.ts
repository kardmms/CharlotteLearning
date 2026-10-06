export const accessibilityDefaults = {
  autoRead: false, speechRate: 1, textSize: 100, lineSpacing: false,
  letterSpacing: false, readingFont: false, highlightSpeech: true,
  compactReading: false, focusMode: false, reducedDistractions: false,
  reducedMotion: false, stepInstructions: false, highlightTask: false,
  readingGuide: false, highContrast: false, largeControls: false,
  colorSafe: false, muteSounds: false,
};
export type AccessibilityPreferences = typeof accessibilityDefaults;

// Whitelist all fields; stored data from older versions safely falls back to defaults.
export function normalizeAccessibility(value: unknown): AccessibilityPreferences {
  const result = { ...accessibilityDefaults };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  const source = value as Record<string, unknown>;
  for (const key of Object.keys(result) as (keyof AccessibilityPreferences)[]) {
    if (key === 'speechRate' || key === 'textSize') continue;
    if (typeof source[key] === 'boolean') result[key] = source[key];
  }
  if (typeof source.speechRate === 'number' && Number.isFinite(source.speechRate)) result.speechRate = Math.max(0.5, Math.min(2, source.speechRate));
  if ([100, 125, 150, 200].includes(Number(source.textSize))) result.textSize = Number(source.textSize);
  return result;
}
