import { Moon, Search, Sun } from "lucide-react";

import { useApp } from "../../hooks/useApp";
import type { Route } from "../../lib/router";
import { pageTitle } from "./AppShell";
import { Button, IconButton, Kbd } from "../ui";

export function Header({ route, onOpenPalette }: { route: Route; onOpenPalette: () => void }) {
  const { t, theme, toggleTheme, locale, setLocale } = useApp();

  return (
    <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4">
      <span className="text-[12px] text-[var(--color-fg-subtle)]">{pageTitle(route.page, t)}</span>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={onOpenPalette}
          className="flex h-7 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] pl-2.5 pr-1.5 text-[12px] text-[var(--color-fg-subtle)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]"
        >
          <Search size={13} />
          <span>{t.shell.commandPaletteHint}</span>
          <Kbd>⌘K</Kbd>
        </button>
        <Button size="sm" variant="ghost" onClick={() => setLocale(locale === "zh" ? "en" : "zh")}>
          {locale === "zh" ? "中" : "EN"}
        </Button>
        <IconButton label={t.shell.toggleTheme} onClick={toggleTheme}>
          {theme === "dark" ? <Moon size={15} /> : <Sun size={15} />}
        </IconButton>
      </div>
    </header>
  );
}
