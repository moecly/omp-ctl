import { type ReactNode, useEffect, useMemo, useState } from "react";

import { AppContext, type Theme, type ThemePref } from "../../hooks/useApp";
import { loadLocale, loadSidebar, loadThemePref, saveLocale, saveSidebar, saveTheme } from "../../lib/prefs";
import { LOCALES, type Locale, assertLocaleParity, strings, type Strings } from "../../lib/i18n";
import { type Route, getRoute, navigate, subscribe } from "../../lib/router";
import { install, register } from "../../lib/hotkeys";
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

export function AppShell({ children }: { children: (route: Route) => ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = loadLocale();
    return stored === "en" || stored === "zh" ? stored : "zh";
  });
  const [themePref, setThemePref] = useState<ThemePref>(() => loadThemePref());
  const [systemLight, setSystemLight] = useState(
    () => window.matchMedia("(prefers-color-scheme: light)").matches,
  );
  const [route, setRoute] = useState(getRoute());
  const [collapsed, setCollapsed] = useState(() => loadSidebar());
  const [paletteOpen, setPaletteOpen] = useState(false);

  const t = useMemo(() => strings(locale), [locale]);

  const theme: Theme = themePref === "auto" ? (systemLight ? "light" : "dark") : themePref;

  useEffect(() => subscribe(setRoute), []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (e: MediaQueryListEvent) => setSystemLight(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveTheme(themePref);
  }, [theme, themePref]);

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
      setLocale: (l: Locale) => {
        setLocaleState(l);
        saveLocale(l);
      },
      t,
      theme,
      themePref,
      setThemePref,
      paletteOpen,
      setPaletteOpen,
    }),
    [locale, t, theme, themePref, paletteOpen],
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
