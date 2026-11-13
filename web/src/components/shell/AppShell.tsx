import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { AppContext, type Theme, type ThemePref } from "../../hooks/useApp";
import {
  hasThemeChoice,
  loadLocale,
  loadSidebar,
  loadThemePref,
  saveLocale,
  saveSidebar,
  saveTheme,
} from "../../lib/prefs";
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

/**
 * Circular theme reveal without cloning the DOM.
 *
 * MaskAnim-style "freeze the old UI, erase it" needs a real screenshot, and a
 * DOM clone is not one: `#root` is a flex child that collapses when detached,
 * so the copy painted an empty full-screen layer — and because the removal
 * listener never fired, that layer stayed and blacked out the window.
 *
 * What is left is the honest version of the same idea, using the browser's own
 * compositor: the layer below is already repainted in the new palette, and a
 * disc of the *old* primary colour expands from the press point and fades. It
 * reads as the new theme growing out of the control, never covers the window,
 * and has no stale-content failure mode.
 */
function reveal(x: number, y: number, radius: number, commit: () => void) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  commit();
  if (reduced) return;

  const disc = document.createElement("div");
  disc.className = "theme-disc";
  disc.style.setProperty("--disc-x", `${x}px`);
  disc.style.setProperty("--disc-y", `${y}px`);
  disc.style.setProperty("--disc-r", `${radius}px`);
  disc.addEventListener("animationend", () => disc.remove());
  // Belt and braces: an animation that never starts must not leave a layer on
  // screen, which is exactly how the previous version could lock up the UI.
  window.setTimeout(() => disc.remove(), 1200);
  document.body.appendChild(disc);
}

export function AppShell({ children }: { children: (route: Route) => ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = loadLocale();
    return stored === "en" || stored === "zh" ? stored : "zh";
  });
  const [systemLocale, setSystemLocale] = useState<Locale | null>(null);
  const [localePinned, setLocalePinned] = useState(() => loadLocale() !== null);
  const [themePref, setThemePref] = useState<ThemePref>(() => loadThemePref());
  // Until the user toggles, the OS wins. `systemLight` still drives the tone so
  // a day/night change applies live instead of freezing the first value.
  const [pinned, setPinned] = useState(() => hasThemeChoice());
  const [systemLight, setSystemLight] = useState(
    () => window.matchMedia("(prefers-color-scheme: light)").matches,
  );
  const [route, setRoute] = useState(getRoute());
  const [collapsed, setCollapsed] = useState(() => loadSidebar());
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [palette, setPaletteState] = useState(() => loadPalette());
  const [font, setFontState] = useState(() => loadFont());

  const t = useMemo(() => strings(locale), [locale]);

  // Single source of truth for the applied tone. `pinned` gates it, so a toggle
  // takes effect on the very next render and nothing later re-derives it.
  const theme: Theme = pinned ? (themePref === "dark" ? "dark" : "light") : systemLight ? "light" : "dark";

  useEffect(() => subscribe(setRoute), []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (e: MediaQueryListEvent) => setSystemLight(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  /*
   * The only place the palette is painted.
   *
   * `setPalette` and `changeTheme` deliberately do not call `applyPalette`
   * themselves: doing it in two places made the effect run again on the next
   * render with the *previous* derived tone, quietly reverting a light/dark
   * switch while the icon and tooltip already said the new one. State changes
   * here, painting follows.
   */
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
   * Switch palette with a circular reveal from the pressed control (MaskAnim).
   *
   * The palette is committed immediately; the transition is a disc of neutral
   * tint that expands from the pressed control and fades, so the change reads as
   * growing out of the click instead of snapping. See `reveal` for why this is
   * not a snapshot-based reveal.
   */
  const setPalette = useCallback(
    (id: string, origin?: { x: number; y: number }) => {
      if (id === palette) return;
      const x = origin?.x ?? window.innerWidth - 64;
      const y = origin?.y ?? 40;
      const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

      const commit = () => {
        applyPalette(paletteById(id), theme === "dark");
        setPaletteState(id);
        savePalette(id);
      };

      reveal(x, y, radius, commit);
    },
    [palette, theme],
  );

  /**
   * Light/dark switch uses the same reveal: the tone is a palette dimension
   * (`applyPalette(..., dark)`), so swapping it changes every colour role at
   * once and a plain boolean flip reads as a flash.
   */
  const changeTheme = useCallback(
    (next: ThemePref, origin?: { x: number; y: number }) => {
      if (pinned && next === themePref) return;
      const x = origin?.x ?? window.innerWidth - 40;
      const y = origin?.y ?? 28;
      const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      // Painted by the palette effect; this only changes state, so the switch
      // happens on one render with no manual re-apply to fight it.
      reveal(x, y, radius, () => {
        // Both halves of the derived tone change together: the pin makes the
        // preference authoritative, the pref is the value itself.
        setPinned(true);
        setThemePref(next);
      });
    },
    [palette, themePref, pinned],
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
      setThemePref: changeTheme,
      palette,
      setPalette,
      font,
      setFont,
      paletteOpen,
      setPaletteOpen,
    }),
    [
      locale,
      setLocale,
      systemLocale,
      t,
      theme,
      themePref,
      changeTheme,
      palette,
      setPalette,
      font,
      setFont,
      paletteOpen,
    ],
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
