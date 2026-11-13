const KEY_LOCALE = "omp-ctl.locale";
const KEY_THEME = "omp-ctl.theme";
const KEY_SIDEBAR = "omp-ctl.sidebar";

export function loadLocale(): string | null {
  return localStorage.getItem(KEY_LOCALE);
}

export function saveLocale(v: string) {
  localStorage.setItem(KEY_LOCALE, v);
}

/** The two tones the UI exposes. Following the OS is the absence of a choice,
 * not a third state: `hasThemeChoice` decides whether the stored value or the OS
 * wins, so nothing downstream has to special-case "auto". */
export type ThemePref = "dark" | "light";

/** Whether the user has ever picked a tone (as opposed to following the OS). */
export function hasThemeChoice(): boolean {
  const v = localStorage.getItem(KEY_THEME);
  return v === "dark" || v === "light";
}

export function loadThemePref(): ThemePref {
  const v = localStorage.getItem(KEY_THEME);
  if (v === "dark" || v === "light") return v;
  // No stored choice: resolve the OS preference now so the first paint matches.
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function saveTheme(v: ThemePref) {
  localStorage.setItem(KEY_THEME, v);
}

export function loadSidebar(): boolean {
  return localStorage.getItem(KEY_SIDEBAR) === "1";
}

export function saveSidebar(v: boolean) {
  localStorage.setItem(KEY_SIDEBAR, v ? "1" : "0");
}

const KEY_PRESET = "omp-ctl.preset";

export function loadPreset(): string {
  return localStorage.getItem(KEY_PRESET) ?? "";
}

export function savePreset(v: string) {
  if (v) localStorage.setItem(KEY_PRESET, v);
  else localStorage.removeItem(KEY_PRESET);
}
