import { getSetting, setSetting } from "../lib/storage.js";

export type Appearance = "system" | "light" | "dark";

export interface ReskinSettings {
  appearance: Appearance;
  /** Restyles LearningSuite's own top navigation in place — see adapters/shell.ts. */
  useCompanionNav: boolean;
  /**
   * Disables card/DOM rewriting; keeps only typography/color polish. The
   * fallback for "LearningSuite changed and an adapter looks wrong" — spec
   * §42.
   */
  compatibilityMode: boolean;
  showUpcomingOnHome: boolean;
  reducedMotion: boolean;
}

export const DEFAULT_SETTINGS: ReskinSettings = {
  appearance: "system",
  useCompanionNav: true,
  compatibilityMode: false,
  showUpcomingOnHome: true,
  reducedMotion: false,
};

const KEY = "settings";

export function loadSettings(): ReskinSettings {
  return { ...DEFAULT_SETTINGS, ...getSetting<Partial<ReskinSettings>>(KEY, {}) };
}

export function saveSettings(settings: ReskinSettings): void {
  setSetting(KEY, settings);
}
