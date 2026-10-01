import { useEffect, useMemo, useState } from "react";

import { useApp } from "../../hooks/useApp";
import { navigate } from "../../lib/router";
import type { Strings } from "../../lib/i18n";
import { cn } from "../../lib/cn";
import { Input, Kbd } from "../ui";

const PAGES: { page: string; key: keyof Strings["nav"] }[] = [
  { page: "overview", key: "overview" },
  { page: "providers", key: "providers" },
  { page: "models", key: "models" },
  { page: "roles", key: "roles" },
  { page: "prompts", key: "prompts" },
  { page: "skills", key: "skills" },
  { page: "agents", key: "agents" },
  { page: "mcp", key: "mcp" },
  { page: "hooks", key: "hooks" },
  { page: "tools", key: "tools" },
  { page: "memory", key: "memory" },
  { page: "settings", key: "settings" },
  { page: "backup", key: "backup" },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, locale, setLocale, toggleTheme } = useApp();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  const results = useMemo(() => {
    const actions = [
      { id: "action:theme", label: t.shell.toggleTheme, group: t.shell.shortcuts, run: toggleTheme },
      {
        id: "action:lang",
        label: `${t.shell.language}: ${locale === "zh" ? "English" : "中文"}`,
        group: t.shell.shortcuts,
        run: () => setLocale(locale === "zh" ? "en" : "zh"),
      },
      ...PAGES.map((p) => ({
        id: `page:${p.page}`,
        label: t.nav[p.key],
        group: t.shell.navigate,
        run: () => navigate(p.page),
      })),
    ];
    const q = query.trim().toLowerCase();
    return q ? actions.filter((a) => a.label.toLowerCase().includes(q)) : actions;
  }, [query, t, locale, setLocale, toggleTheme]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
    }
  }, [open]);

  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, results.length - 1)));
  }, [results.length]);

  if (!open) return null;

  const run = (index: number) => {
    const item = results[index];
    if (!item) return;
    item.run();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--color-overlay)] pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal
        className="flex max-h-[70vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)]"
      >
        <div className="border-b border-[var(--color-border)] p-3">
          <Input
            autoFocus
            placeholder={t.shell.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                run(cursor);
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          {results.length === 0 && (
            <div className="px-3 py-6 text-center text-[12px] text-[var(--color-fg-subtle)]">{t.shell.noResults}</div>
          )}
          {results.map((item, i) => (
            <button
              key={item.id}
              type="button"
              data-active={i === cursor}
              onMouseEnter={() => setCursor(i)}
              onClick={() => run(i)}
              className={cn(
                "flex h-[34px] w-full items-center gap-3 rounded-[var(--radius-md)] px-3 text-left text-[13px]",
                i === cursor ? "bg-[var(--color-hover)] text-[var(--color-fg)]" : "text-[var(--color-fg-muted)]",
              )}
            >
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <span className="shrink-0 text-[11px] text-[var(--color-fg-subtle)]">{item.group}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 border-t border-[var(--color-border)] px-3 py-2 text-[11px] text-[var(--color-fg-subtle)]">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          <span>{t.shell.paletteMove}</span>
          <Kbd>Enter</Kbd>
          <span>{t.shell.paletteRun}</span>
          <Kbd>Esc</Kbd>
          <span>{t.shell.paletteClose}</span>
        </div>
      </div>
    </div>
  );
}
