const KEY_LOCALE = "omp-ctl.locale";
const KEY_THEME = "omp-ctl.theme";
const KEY_SIDEBAR = "omp-ctl.sidebar";

export function loadLocale(): string | null {
  return localStorage.getItem(KEY_LOCALE);
}

export function saveLocale(v: string) {
  localStorage.setItem(KEY_LOCALE, v);
}

export type ThemePref = "dark" | "light" | "auto";

export function loadThemePref(): ThemePref {
  const v = localStorage.getItem(KEY_THEME);
  return v === "dark" || v === "light" || v === "auto" ? v : "dark";
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
