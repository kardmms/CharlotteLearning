import "server-only";
import { isGamesFeatureEnabled } from "./games-feature-policy";

export function gamesFeatureEnabled() {
  return isGamesFeatureEnabled(process.env);
}
