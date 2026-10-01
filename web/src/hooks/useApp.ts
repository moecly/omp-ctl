import { createContext, useContext } from "react";

import type { Locale, Strings } from "../lib/i18n";

export type Theme = "dark" | "light";

export interface AppContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Strings;
  theme: Theme;
  toggleTheme: () => void;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppShell");
  return ctx;
}
