import { PALETTES, type Palette, DEFAULT_PALETTE } from "./palettes";

/** Persisted appearance choices. Theme is separate from the palette. */
export interface Appearance {
  palette: string;
  font: string;
}

const KEY_PALETTE = "omp-ctl.palette";
const KEY_FONT = "omp-ctl.font";

/** Family name of the bundled font, as declared in `app.css`. */
export const BUNDLED_FONT = "ChillRoundM";

export const SYSTEM_FONT = "system";

/**
 * System fallback chain, shared with the `--font-mono` tail in `app.css`.
 *
 * Ordered per platform: `PingFang SC` is the macOS CJK face, `Microsoft YaHei`
 * the Windows one, `Noto Sans CJK SC` the Linux one. Without the explicit
 * `Noto Sans SC` entry Windows picked `Segoe UI Symbol` for punctuation.
 */
export const SYSTEM_STACK = `-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", "Noto Sans CJK SC", sans-serif`;

export function paletteById(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES.find((p) => p.id === DEFAULT_PALETTE) ?? PALETTES[0];
}

export function loadPalette(): string {
  const v = localStorage.getItem(KEY_PALETTE);
  return v && PALETTES.some((p) => p.id === v) ? v : DEFAULT_PALETTE;
}

export function savePalette(id: string) {
  localStorage.setItem(KEY_PALETTE, id);
}

export function loadFont(): string {
  return localStorage.getItem(KEY_FONT) || BUNDLED_FONT;
}

export function saveFont(family: string) {
  localStorage.setItem(KEY_FONT, family);
}

/**
 * Write one palette's roles onto the document as `--m3-*` variables.
 *
 * Kept out of React so the pre-hydration script in `index.html` can call the
 * same code before first paint (no flash of the wrong palette).
 */
export function applyPalette(palette: Palette, dark: boolean) {
  const root = document.documentElement;
  const roles = dark ? palette.dark : palette.light;
  for (const [role, value] of Object.entries(roles)) {
    root.style.setProperty(`--m3-${role}`, value);
  }
  root.dataset.palette = palette.id;
  root.dataset.tone = dark ? "dark" : "light";
}

/**
 * CSS `font-family` value for a stored font choice.
 *
 * The bundled face is selected by name exactly like an imported one, so both
 * take the quoted branch; only "follow the system" drops the leading family.
 */
export function fontStack(family: string): string {
  const fallback = SYSTEM_STACK;
  if (!family || family === SYSTEM_FONT) return fallback;
  // Imported fonts keep their file stem as the family name.
  return `"${family}", ${fallback}`;
}

/** Make an imported font loadable by injecting an `@font-face` rule. */
export function registerImportedFont(family: string, url: string) {
  const id = `font-${family.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `@font-face{font-family:"${family}";src:url("${url}");font-display:swap;}`;
  document.head.appendChild(style);
}
