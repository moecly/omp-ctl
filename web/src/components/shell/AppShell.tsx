import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { AppContext, type Theme, type ThemePref } from "../../hooks/useApp";
import { loadLocale, loadSidebar, loadThemePref, saveLocale, saveSidebar, saveTheme } from "../../lib/prefs";
import {
  applyPalette,
  BUNDLED_FONT,
  fontStack,
  loadFont,
  loadPalette,
  paletteById,
  registerImportedFont,
  saveFont,
  savePalette,
} from "../../lib/appearance";
import { LOCALES, type Locale, assertLocaleParity, strings, type Strings } from "../../lib/i18n";
import { type Route, getRoute, navigate, subscribe } from "../../lib/router";
import { install, register } from "../../lib/hotkeys";
import { ipc } from "../../lib/ipc";
import { ToastHost } from "../ui/ToastHost";
import { Header } from "./Header";
import { Sidebar, NAV } from "./Sidebar";
import { CommandPalette } from "./CommandPalette";

const PAGE_TITLES: Record<string, keyof Strings["nav"]> = {
  overview: "overview",
  providers: "providers",
  models: "models",
  roles: "roles",
  prompts: "prompts",
  skills: "skills",
  agents: "agents",
  mcp: "mcp",
  hooks: "hooks",
  tools: "tools",
  memory: "memory",
  workspaces: "workspaces",
  backup: "backup",
  extensions: "extensions",
  keybindings: "keybindings",
  settings: "settings",
};

export function pageTitle(page: string, t: Strings): string {
  const key = PAGE_TITLES[page];
  return key ? t.nav[key] : t.appName;
}

/** BCP-47-ish tag for the OS locale, used for tooltips on the language control. */
function matchesLocale(tag: string, locale: Locale): boolean {
  return tag.toLowerCase().startsWith(locale);
}

export function AppShell({ children }: { children: (route: Route) => ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = loadLocale();
    return stored === "en" || stored === "zh" ? stored : "zh";
  });
  const [systemLocale, setSystemLocale] = useState<Locale | null>(null);
  const [localePinned, setLocalePinned] = useState(() => loadLocale() !== null);
  const [themePref, setThemePref] = useState<ThemePref>(() => loadThemePref());
  const [systemLight, setSystemLight] = useState(
    () => window.matchMedia("(prefers-color-scheme: light)").matches,
  );
  const [route, setRoute] = useState(getRoute());
  const [collapsed, setCollapsed] = useState(() => loadSidebar());
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [palette, setPaletteState] = useState(() => loadPalette());
  const [font, setFontState] = useState(() => loadFont());

  const t = useMemo(() => strings(locale), [locale]);

  const theme: Theme = themePref === "auto" ? (systemLight ? "light" : "dark") : themePref;

  useEffect(() => subscribe(setRoute), []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (e: MediaQueryListEvent) => setSystemLight(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Palette + tone on every change: `applyPalette` writes `--m3-*` inline, which
  // overrides the static blocks selected by the data attributes.
  useEffect(() => {
    applyPalette(paletteById(palette), theme === "dark");
    saveTheme(themePref);
  }, [palette, theme, themePref]);

  useEffect(() => {
    document.documentElement.style.setProperty("--font-sans", fontStack(font));
    saveFont(font);
  }, [font]);

  useEffect(() => {
    if (font === BUNDLED_FONT || font === "system") return;
    let alive = true;
    ipc
      .fontUrl(font)
      .then((url) => {
        if (alive) registerImportedFont(font, url);
      })
      .catch(() => {
        // A missing font file falls back to the system stack, which is a
        // cosmetic degradation, not something worth interrupting the user for.
      });
    return () => {
      alive = false;
    };
  }, [font]);

  // Follow the OS language until the user picks one explicitly.
  useEffect(() => {
    let alive = true;
    ipc
      .systemLocale()
      .then((info) => {
        if (!alive) return;
        const detected = (LOCALES as readonly string[]).find((l) => matchesLocale(info.system, l as Locale));
        const resolved = (detected as Locale | undefined) ?? "en";
        setSystemLocale(resolved);
        if (!localePinned) setLocaleState(resolved);
      })
      .catch(() => setSystemLocale(null));
    return () => {
      alive = false;
    };
  }, [localePinned]);

  /**
   * Switch palette with a circular spread from the pressed control.
   *
   * A disc of the incoming primary colour is inserted at the click point and
   * clipped to a growing circle while the palette variables change underneath,
   * so the new colour appears to travel outward. Only the disc animates: the
   * palette swap itself is immediate, which is what keeps every label readable
   * during the transition instead of cross-fading two colour systems.
   */
  const setPalette = useCallback(
    (id: string, origin?: { x: number; y: number }) => {
      if (id === palette) return;
      const root = document.documentElement;
      const x = origin?.x ?? window.innerWidth - 64;
      const y = origin?.y ?? 40;
      const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      root.style.setProperty("--spread-x", `${x}px`);
      root.style.setProperty("--spread-y", `${y}px`);
      root.style.setProperty("--spread-r", `${radius}px`);

      applyPalette(paletteById(id), theme === "dark");
      setPaletteState(id);
      savePalette(id);

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const disc = document.createElement("div");
      disc.className = "theme-spread";
      disc.addEventListener("animationend", () => disc.remove());
      document.body.appendChild(disc);
    },
    [palette, theme],
  );

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    setLocalePinned(true);
    saveLocale(l);
  }, []);

  const setFont = useCallback((family: string) => setFontState(family), []);

  useEffect(() => {
    if (import.meta.env.DEV) assertLocaleParity();
  }, []);
  useEffect(() => install(), []);

  useEffect(() => {
    const offs = [
      register({ id: "palette", keys: "mod+k", description: t.shell.commandPalette, run: () => setPaletteOpen((v) => !v) }),
      register({
        id: "sidebar",
        keys: "mod+b",
        description: t.shell.toggleSidebar,
        run: () => setCollapsed((v) => {
          saveSidebar(!v);
          return !v;
        }),
      }),
      register({ id: "settings", keys: "mod+,", description: t.nav.settings, run: () => navigate("settings") }),
      ...NAV.slice(0, 9).map((item, i) =>
        register({
          id: `nav-${item.page}`,
          keys: `mod+${i + 1}`,
          description: t.nav[item.key],
          run: () => navigate(item.page),
        }),
      ),
    ];
    return () => offs.forEach((off) => off());
  }, [t]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      systemLocale,
      t,
      theme,
      themePref,
      setThemePref,
      palette,
      setPalette,
      font,
      setFont,
      paletteOpen,
      setPaletteOpen,
    }),
    [locale, setLocale, systemLocale, t, theme, themePref, palette, setPalette, font, setFont, paletteOpen],
  );

  return (
    <AppContext.Provider value={value}>
      <div className="flex h-full w-full">
        <Sidebar
          route={route}
          collapsed={collapsed}
          onToggle={() => {
            setCollapsed((v) => {
              saveSidebar(!v);
              return !v;
            });
          }}
          onNavigate={(page) => navigate(page)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header route={route} onOpenPalette={() => setPaletteOpen(true)} />
          {children(route)}
        </div>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ToastHost />
    </AppContext.Provider>
  );
}

export { LOCALES };
