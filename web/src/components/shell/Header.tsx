import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Check, ChevronDown, Globe, Moon, Palette as PaletteIcon, Search, Sun } from "lucide-react";

import { useApp } from "../../hooks/useApp";
import type { Route } from "../../lib/router";
import { pageTitle } from "./AppShell";
import { PALETTES } from "../../lib/palettes";
import { LOCALES, type Locale } from "../../lib/i18n";
import { cn } from "../../lib/cn";
import { useRipple } from "../../lib/ripple";
import { IconButton, Kbd } from "../ui";

const LOCALE_LABEL: Record<Locale, string> = { zh: "中文", en: "English" };

/** Dismiss on outside click or Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

export function Header({ route, onOpenPalette }: { route: Route; onOpenPalette: () => void }) {
  const { t, theme, setThemePref, locale, setLocale, palette, setPalette } = useApp();
  const [paletteMenu, setPaletteMenu] = useState(false);
  const [localeMenu, setLocaleMenu] = useState(false);
  const paletteRef = useDismiss(paletteMenu, () => setPaletteMenu(false));
  const localeRef = useDismiss(localeMenu, () => setLocaleMenu(false));
  const { ripple, rippleTarget } = useRipple();

  const active = PALETTES.find((p) => p.id === palette) ?? PALETTES[0];

  return (
    <header className="relative z-40 flex h-[56px] shrink-0 items-center gap-2 bg-[var(--color-bg)] px-4">
      <span className="text-[13px] font-medium text-[var(--color-fg-muted)]">{pageTitle(route.page, t)}</span>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={onOpenPalette}
          className="flex h-9 items-center gap-2 rounded-full border border-[var(--color-border)] pl-3 pr-2 text-[12px] text-[var(--color-fg-subtle)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
        >
          <Search size={14} />
          <span className="hidden sm:inline">{t.shell.commandPaletteHint}</span>
          <Kbd>⌘K</Kbd>
        </button>

        <div className="relative" ref={localeRef}>
          <IconButton
            label={`${t.shell.language}: ${LOCALE_LABEL[locale]}`}
            onClick={() => {
              setLocaleMenu((v) => !v);
              setPaletteMenu(false);
            }}
            active={localeMenu}
            className="h-9 w-9 rounded-full"
          >
            <Globe size={16} strokeWidth={2} />
          </IconButton>
          {localeMenu && (
            <div className="dialog-in absolute right-0 top-11 z-50 min-w-[180px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-md)]">
              {LOCALES.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => {
                    setLocale(l);
                    setLocaleMenu(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-[13px]",
                    l === locale ? "text-[var(--color-fg)]" : "text-[var(--color-fg-muted)] hover:bg-[var(--color-hover)]",
                  )}
                >
                  <span className="flex h-4 w-4 items-center justify-center">{l === locale && <Check size={14} />}</span>
                  {LOCALE_LABEL[l]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative" ref={paletteRef}>
          <button
            type="button"
            title={`${t.shell.palette}: ${locale === "zh" ? active.zh : active.en}`}
            aria-label={`${t.shell.palette}: ${locale === "zh" ? active.zh : active.en}`}
            onClick={() => {
              setPaletteMenu((v) => !v);
              setLocaleMenu(false);
            }}
            className={cn(
              "relative isolate flex h-9 items-center gap-1.5 overflow-hidden rounded-full border border-[var(--color-border)] px-2.5 text-[12px] text-[var(--color-fg-muted)]",
              "transition-colors hover:bg-[var(--color-hover)]",
              paletteMenu && "bg-[var(--color-active)] text-[var(--color-fg)]",
            )}
          >
            <span className="flex gap-0.5">
              {[active.light.primary, active.light.tertiary, active.dark.primary].map((color, i) => (
                <span
                  key={i}
                  className="h-3.5 w-3.5 rounded-full transition-[background-color] duration-[var(--dur-medium)] ease-[var(--ease-emphasized)]"
                  style={{ background: color }}
                />
              ))}
            </span>
            <ChevronDown size={13} />
          </button>
          {paletteMenu && (
            <div className="dialog-in absolute right-0 top-11 z-50 w-[248px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-[var(--shadow-md)]">
              <div className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] uppercase tracking-wide text-[var(--color-fg-subtle)]">
                <PaletteIcon size={12} />
                {t.shell.palette}
              </div>
              {PALETTES.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={(e) => {
                    // Close the menu *before* the reveal snapshots the frame.
                    // Otherwise the frozen copy still shows the open menu and
                    // the user watches it linger, then pop away when the mask
                    // finishes — the "page refreshed itself" flicker.
                    flushSync(() => setPaletteMenu(false));
                    setPalette(p.id, { x: e.clientX, y: e.clientY });
                  }}
                  className={cn(
                    "list-in flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-[13px]",
                    p.id === palette
                      ? "bg-[var(--color-active)] text-[var(--color-fg)]"
                      : "text-[var(--color-fg-muted)] hover:bg-[var(--color-hover)]",
                  )}
                  style={{ ["--list-index" as string]: i }}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-2)]">
                    <span className="h-4 w-4 rounded-full" style={{ background: p.light.primary }} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{locale === "zh" ? p.zh : p.en}</span>
                  {p.id === palette && <Check size={14} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          title={`${t.shell.theme}: ${theme === "dark" ? t.shell.themeDark : t.shell.themeLight}`}
          aria-label={`${t.shell.theme}: ${theme === "dark" ? t.shell.themeDark : t.shell.themeLight}`}
          onPointerDown={ripple}
          ref={rippleTarget as React.Ref<HTMLButtonElement>}
          onClick={(e) => setThemePref(theme === "dark" ? "light" : "dark", { x: e.clientX, y: e.clientY })}
          className="relative isolate flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-[var(--color-fg-muted)] transition-colors duration-[var(--dur-short)] hover:bg-[color-mix(in_srgb,var(--color-fg)_8%,transparent)] hover:text-[var(--color-fg)]"
        >
          {/* Two icons cross-fade instead of popping: only the active one is
              visible, stacked and scaled slightly, so the toggle reads as a
              morph rather than a glyph swap. */}
          {([["light", Sun], ["dark", Moon]] as const).map(([key, Glyph]) => (
            <span
              key={key}
              aria-hidden={theme !== key}
              className={cn(
                "absolute flex transition-[opacity,transform] duration-[var(--dur-medium)] ease-[var(--ease-emphasized)]",
                theme === key ? "scale-100 opacity-100" : "scale-75 opacity-0",
              )}
            >
              <Glyph size={16} />
            </span>
          ))}
        </button>
      </div>
    </header>
  );
}
