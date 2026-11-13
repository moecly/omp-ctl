import { createContext, useContext } from "react";

import type { Locale, Strings } from "../lib/i18n";
import type { Palette } from "../lib/palettes";
import type { ThemePref } from "../lib/prefs";

export type Theme = "dark" | "light";
export type { ThemePref };

export interface AppContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** Locale the OS reports, or null while detection is still running. */
  systemLocale: Locale | null;
  t: Strings;
  theme: Theme;
  themePref: ThemePref;
  setThemePref: (p: ThemePref, origin?: { x: number; y: number }) => void;
  /** Palette id currently applied. */
  palette: string;
  /** Switch palette, animating the change from a screen point. */
  setPalette: (id: string, origin?: { x: number; y: number }) => void;
  /** Font choice: `system`, the bundled family, or an imported file stem. */
  font: string;
  setFont: (family: string) => void;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppShell");
  return ctx;
}

export type { Palette };
