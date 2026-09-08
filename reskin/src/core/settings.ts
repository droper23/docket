import { getSetting, setSetting } from "../lib/storage.js";

export type Appearance = "system" | "light" | "dark";

/**
 * Curated canvas palettes (Sep 2026 pass, issue #3) — "Background" in Settings.
 * Deliberately a fixed palette, not a raw color picker: the macOS System
 * Settings Appearance pane's six-tint wallpaper row is the interaction model
 * the brief asked for, and a curated set can stay HIG-legible (every value
 * below keeps LearningSuite's near-black/near-white foreground readable on
 * it in BOTH themes — a free-form picker could not promise that). Each value
 * maps to a light + dark `--docket-canvas` override in tokens.css, keyed off
 * the `data-docket-background` attribute src/index.ts writes to <html>.
 */
export type BackgroundChoice = "default" | "graphite" | "blue" | "purple" | "rose" | "sand";

export const BACKGROUND_CHOICES: BackgroundChoice[] = ["default", "graphite", "blue", "purple", "rose", "sand"];

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
  reducedMotion: boolean;
  background: BackgroundChoice;
  /**
   * Per-course accent overrides, keyed by course code (see courseColor.ts's `codeKey()`) — a
   * course with no entry here keeps its automatic palette-by-sorted-index color. Settings >
   * Course Colors is the only writer; every adapter that calls `assignCourseColors()` reads
   * this same map so an override applies everywhere that course's accent shows up.
   */
  courseColors: Record<string, string>;
}

export const DEFAULT_SETTINGS: ReskinSettings = {
  appearance: "system",
  useCompanionNav: true,
  compatibilityMode: false,
  reducedMotion: false,
  background: "default",
  courseColors: {},
};

const KEY = "settings";

export function loadSettings(): ReskinSettings {
  return { ...DEFAULT_SETTINGS, ...getSetting<Partial<ReskinSettings>>(KEY, {}) };
}

export function saveSettings(settings: ReskinSettings): void {
  setSetting(KEY, settings);
}
