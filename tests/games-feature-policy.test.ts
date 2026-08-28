import assert from "node:assert/strict";
import test from "node:test";
import { isGamesFeatureEnabled } from "../src/lib/games-feature-policy.ts";

test("games default on locally and off in hosted environments", () => {
  assert.equal(isGamesFeatureEnabled({}), true);
  assert.equal(isGamesFeatureEnabled({ VERCEL_ENV: "production" }), false);
  assert.equal(isGamesFeatureEnabled({ DEPLOYMENT_ENV: "preview" }), false);
  assert.equal(isGamesFeatureEnabled({ DATABASE_ENVIRONMENT: "production" }), false);
});

test("explicit feature flags control local and hosted games", () => {
  assert.equal(isGamesFeatureEnabled({ GAMES_FEATURE_ENABLED: "false" }), false);
  assert.equal(isGamesFeatureEnabled({ VERCEL_ENV: "production", GAMES_FEATURE_ENABLED: "true" }), true);
});

test("the hosted test closes exactly at the cutoff and stays closed", () => {
  const environment = {
    VERCEL_ENV: "production",
    GAMES_FEATURE_ENABLED: "true",
    GAMES_FEATURE_EXPIRES_AT: "2026-08-28T08:00:00-07:00"
  };
  const deadline = Date.parse(environment.GAMES_FEATURE_EXPIRES_AT);
  assert.equal(isGamesFeatureEnabled(environment, deadline - 1), true);
  assert.equal(isGamesFeatureEnabled(environment, deadline), false);
  assert.equal(isGamesFeatureEnabled(environment, deadline + 1), false);
});

test("invalid hosted cutoffs fail closed without disabling local development", () => {
  const environment = { GAMES_FEATURE_ENABLED: "true", GAMES_FEATURE_EXPIRES_AT: "invalid" };
  assert.equal(isGamesFeatureEnabled({ ...environment, VERCEL_ENV: "production" }), false);
  assert.equal(isGamesFeatureEnabled(environment), true);
});
