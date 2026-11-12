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

/** CSS `font-family` value for a stored font choice. */
export function fontStack(family: string): string {
  if (!family || family === SYSTEM_FONT) {
    return `-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", sans-serif`;
  }
  if (family === BUNDLED_FONT) {
    return `"${BUNDLED_FONT}", -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", sans-serif`;
  }
  // Imported fonts keep their file stem as the family name.
  return `"${family}", -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", sans-serif`;
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
