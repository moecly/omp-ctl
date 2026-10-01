const KEY_LOCALE = "omp-ctl.locale";
const KEY_THEME = "omp-ctl.theme";
const KEY_SIDEBAR = "omp-ctl.sidebar";

export function loadLocale(): string | null {
  return localStorage.getItem(KEY_LOCALE);
}

export function saveLocale(v: string) {
  localStorage.setItem(KEY_LOCALE, v);
}

export function loadTheme(): string | null {
  return localStorage.getItem(KEY_THEME);
}

export function saveTheme(v: string) {
  localStorage.setItem(KEY_THEME, v);
}

export function loadSidebar(): boolean {
  return localStorage.getItem(KEY_SIDEBAR) === "1";
}

export function saveSidebar(v: boolean) {
  localStorage.setItem(KEY_SIDEBAR, v ? "1" : "0");
}
