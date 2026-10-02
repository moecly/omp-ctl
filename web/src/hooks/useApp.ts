import { createContext, useContext } from "react";

import type { Locale, Strings } from "../lib/i18n";
import type { ThemePref } from "../lib/prefs";

export type Theme = "dark" | "light";
export type { ThemePref };

export interface AppContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Strings;
  theme: Theme;
  themePref: ThemePref;
  setThemePref: (p: ThemePref) => void;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppShell");
  return ctx;
}
