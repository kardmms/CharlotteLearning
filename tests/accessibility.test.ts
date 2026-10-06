import test from 'node:test';
import assert from 'node:assert/strict';
import { accessibilityDefaults, normalizeAccessibility } from '../src/lib/accessibility.ts';
test('invalid and legacy preferences safely normalize without arbitrary keys', () => {
  assert.deepEqual(normalizeAccessibility(null), accessibilityDefaults);
  assert.deepEqual(normalizeAccessibility([]), accessibilityDefaults);
  const value = normalizeAccessibility({ highContrast: 'false', speechRate: 100, textSize: 333, unknown: true });
  assert.equal(value.highContrast, false);
  assert.equal(value.speechRate, 2);
  assert.equal(value.textSize, 100);
  assert.equal('unknown' in value, false);
  assert.equal(normalizeAccessibility({ speechRate: NaN }).speechRate, 1);
});
test('combined preferences survive a JSON round trip', () => {
  const value = { ...accessibilityDefaults, highContrast: true, focusMode: true, autoRead: true, reducedMotion: true, textSize: 200, speechRate: 0.75 };
  assert.deepEqual(normalizeAccessibility(JSON.parse(JSON.stringify(value))), value);
});
