import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Trash2, Upload } from "lucide-react";

import { useApp } from "../hooks/useApp";
import { useAsync } from "../hooks/useAsync";
import { ipc } from "../lib/ipc";
import { errorText, type ImportedFont, type SettingEntry, type SettingsCatalog } from "../lib/types";
import { displayValue, toSettingInput } from "../lib/format";
import { settingLabel, tabLabel } from "../lib/settingLabels";
import { descriptionZh } from "../lib/settingDescriptions";
import { BUNDLED_FONT, SYSTEM_FONT } from "../lib/appearance";
import { PALETTES } from "../lib/palettes";
import { toast } from "../lib/toast";
import { cn } from "../lib/cn";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Input,
  SearchInput,
  Select,
  Switch,
} from "../components/ui";
import { PageError, PageSkeleton } from "../components/ui/PageState";
import { PageContainer } from "../components/shell/PageContainer";
import { DefaultsPanel } from "../components/settings/DefaultsPanel";

const OMPCTL_TAB = "local:ompctl";
const APPEARANCE_TAB = "local:appearance";

/** A section heading inside a settings panel. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="px-1 text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
        {title}
      </h2>
      <div className="overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
        {children}
      </div>
    </section>
  );
}

/**
 * Appearance panel: palette, font and language.
 *
 * Everything here is a local preference stored in `localStorage`, so the
 * controls apply instantly and never touch omp's config.
 */
function AppearancePanel() {
  const { t, locale, setLocale, systemLocale, palette, setPalette, font, setFont } = useApp();
  const fonts = useAsync<ImportedFont[]>(() => ipc.listImportedFonts(), []);
  const [deleting, setDeleting] = useState<ImportedFont | null>(null);

  const rows = fonts.data ?? [];

  const pick = async () => {
    // The webview cannot show a native file dialog without a plugin, so the
    // backend path is entered directly; this keeps the app dependency-free.
    const path = window.prompt(t.settings.fontImportPrompt, "");
    if (!path?.trim()) return;
    try {
      const imported = await ipc.importFont(path.trim());
      toast.success(t.settings.fontImported, imported.family);
      setFont(imported.family);
      fonts.reload();
    } catch (e) {
      toast.error(t.settings.fontImportFailed, errorText(e));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Group title={t.settings.appearanceColor}>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2 p-4">
          {PALETTES.map((p, i) => {
            const active = p.id === palette;
            return (
              <button
                key={p.id}
                type="button"
                onClick={(e) => setPalette(p.id, { x: e.clientX, y: e.clientY })}
                style={{ ["--list-index" as string]: i }}
                className={cn(
                  "list-in flex items-center gap-2.5 rounded-[var(--radius-md)] border-2 p-2.5 text-left transition-[border-color,background-color] duration-[var(--dur-short)]",
                  active
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                    : "border-transparent bg-[var(--color-surface-2)] hover:bg-[var(--color-hover)]",
                )}
              >
                <span className="flex shrink-0 items-center">
                  <span
                    className="h-7 w-7 rounded-full"
                    style={{ background: p.light.primary, boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.08)" }}
                  />
                  <span
                    className="-ml-2 h-7 w-7 rounded-full"
                    style={{ background: p.light.tertiary, boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.08)" }}
                  />
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[var(--color-fg)]">
                  {locale === "zh" ? p.zh : p.en}
                </span>
              </button>
            );
          })}
        </div>
      </Group>

      <Group title={t.settings.appearanceFont}>
        <div className="flex flex-col divide-y divide-[var(--color-border)]">
          {[
            { id: BUNDLED_FONT, label: t.settings.fontBundled, hint: t.settings.fontBundledHint },
            { id: SYSTEM_FONT, label: t.settings.fontSystem, hint: t.settings.fontSystemHint },
            ...rows.map((f) => ({ id: f.family, label: f.family, hint: f.fileName })),
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFont(option.id)}
              className="flex items-center gap-3 px-4 py-3 text-left transition-colors duration-[var(--dur-short)] hover:bg-[var(--color-hover)]"
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                  option.id === font ? "border-[var(--color-accent)]" : "border-[var(--color-border-strong)]",
                )}
              >
                {option.id === font && <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-accent)]" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-[var(--color-fg)]">{option.label}</span>
                <span className="block truncate text-[11px] text-[var(--color-fg-subtle)]">{option.hint}</span>
              </span>
              {rows.some((f) => f.family === option.id) && (
                <IconButton
                  label={t.common.delete}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleting(rows.find((f) => f.family === option.id) ?? null);
                  }}
                >
                  <Trash2 size={15} strokeWidth={2.2} />
                </IconButton>
              )}
            </button>
          ))}
          <div className="flex items-center gap-2 px-4 py-3">
            <Button size="sm" variant="tonal" onClick={pick}>
              <Upload size={15} strokeWidth={2.2} />
              {t.settings.fontImport}
            </Button>
            <span className="text-[11px] text-[var(--color-fg-subtle)]">{t.settings.fontImportHint}</span>
          </div>
        </div>
      </Group>

      <Group title={t.settings.appearanceLanguage}>
        <div className="p-4">
          <Select className="max-w-[260px]" value={locale} onChange={(e) => setLocale(e.target.value as "zh" | "en")}>
            <option value="zh">中文</option>
            <option value="en">English</option>
          </Select>
          <p className="mt-2 text-[11px] text-[var(--color-fg-subtle)]">
            {systemLocale
              ? `${t.settings.systemLanguage}: ${systemLocale}`
              : t.settings.systemLanguageDetecting}
          </p>
        </div>
      </Group>

      <ConfirmDialog
        open={deleting !== null}
        title={t.settings.fontRemoveTitle}
        message={t.settings.fontRemoveConfirm.replace("{name}", deleting?.family ?? "")}
        confirmLabel={t.common.delete}
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          const target = deleting!;
          setDeleting(null);
          try {
            await ipc.removeImportedFont(target.family);
            if (font === target.family) setFont(BUNDLED_FONT);
            fonts.reload();
            toast.success(t.common.delete, target.family);
          } catch (e) {
            toast.error(t.common.delete, errorText(e));
          }
        }}
      />
    </div>
  );
}

export function Settings() {
  const { t, locale } = useApp();
  const catalog = useAsync<SettingsCatalog>(() => ipc.listSettings(), []);
  const [tab, setTab] = useState(OMPCTL_TAB);
  const [query, setQuery] = useState("");
  const [resetting, setResetting] = useState<SettingEntry | null>(null);

  const entries = catalog.data?.entries ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (q) {
        return (
          e.key.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          settingLabel(e.key, locale).toLowerCase().includes(q)
        );
      }
      return e.tab === tab;
    });
  }, [entries, query, tab]);

  const save = async (entry: SettingEntry, raw: string) => {
    try {
      await ipc.setSetting(entry.key, raw);
      toast.success(t.common.save, entry.key);
      catalog.reload();
    } catch (e) {
      toast.error(t.common.save, errorText(e));
    }
  };

  // Local tabs use a `local:` prefix because omp ships its own `appearance` tab;
  // prefixing keeps both reachable and makes the source of each tab obvious.
  const tabs = [
    { id: OMPCTL_TAB, label: t.settings.ompCtl },
    { id: APPEARANCE_TAB, label: t.settings.appearance },
    ...(catalog.data?.tabs ?? []).map((id) => ({ id, label: tabLabel(id, locale) })),
  ];

  return (
    <PageContainer
      title={t.settings.title}
      description={t.pageDesc.settings.replace("{n}", String(entries.length))}
      actions={
        <Button variant="tonal" size="sm" onClick={catalog.reload}>
          <RotateCcw size={15} strokeWidth={2.2} />
          {t.common.refresh}
        </Button>
      }
    >
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex shrink-0 flex-row gap-1 overflow-x-auto lg:w-[200px] lg:flex-col lg:overflow-visible">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                setQuery("");
              }}
              className={cn(
                "flex h-10 shrink-0 items-center rounded-full px-4 text-left text-[13px] font-medium transition-colors duration-[var(--dur-short)]",
                !query && id === tab
                  ? "bg-[var(--m3-secondary-container)] text-[var(--m3-on-secondary-container)]"
                  : "text-[var(--color-fg-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === APPEARANCE_TAB ? (
          <div className="min-w-0 flex-1">
            <AppearancePanel />
          </div>
        ) : tab === OMPCTL_TAB ? (
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <DefaultsPanel />
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="max-w-[360px]">
              <SearchInput value={query} onChange={setQuery} placeholder={t.common.search} />
            </div>

            {catalog.loading ? (
              <PageSkeleton rows={6} rowHeight={56} />
            ) : catalog.error ? (
              <PageError message={catalog.error} onRetry={catalog.reload} />
            ) : filtered.length === 0 ? (
              <EmptyState title={t.common.empty} desc={t.settings.searchHint} />
            ) : (
              <div className="overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
                {filtered.map((entry, i) => (
                  <SettingRow
                    key={entry.key}
                    index={i}
                    entry={entry}
                    onSave={save}
                    onReset={() => setResetting(entry)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={resetting !== null}
        title={t.common.reset}
        message={t.settings.resetConfirm.replace("{key}", resetting?.key ?? "")}
        confirmLabel={t.common.reset}
        onCancel={() => setResetting(null)}
        onConfirm={async () => {
          const entry = resetting!;
          setResetting(null);
          try {
            await ipc.resetSetting(entry.key);
            toast.success(t.common.reset, entry.key);
            catalog.reload();
          } catch (e) {
            toast.error(t.common.reset, errorText(e));
          }
        }}
      />
    </PageContainer>
  );
}

/**
 * One settings row: Chinese title, raw key as subtitle, omp's description last.
 *
 * The three lines answer "what is this", "where is it stored" and "what does it
 * do" without the reader having to decode camelCase.
 */
function SettingRow({
  index,
  entry,
  onSave,
  onReset,
}: {
  index: number;
  entry: SettingEntry;
  onSave: (entry: SettingEntry, raw: string) => void;
  onReset: () => void;
}) {
  const { t, locale } = useApp();
  const [value, setValue] = useState(() => toSettingInput(entry.value));

  useEffect(() => {
    setValue(toSettingInput(entry.value));
  }, [entry.value]);

  const dirty = value !== toSettingInput(entry.value);
  // omp does not localise setting descriptions, so Chinese falls back to the
  // translation table before omp's English text.
  const description = locale === "zh" ? (descriptionZh(entry.key) ?? entry.description) : entry.description;

  return (
    <div
      style={{ ["--list-index" as string]: Math.min(index, 12) }}
      className="list-in group flex flex-col gap-2 border-b border-[var(--color-border)] px-4 py-3.5 last:border-b-0 transition-colors duration-[var(--dur-short)] hover:bg-[color-mix(in_srgb,var(--color-fg)_4%,transparent)] sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium text-[var(--color-fg)]">{settingLabel(entry.key, locale)}</span>
          <Badge tone="neutral">{entry.ty}</Badge>
          {entry.configured && <Badge tone="ok">{t.settings.configured}</Badge>}
        </div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-[var(--color-fg-subtle)]">{entry.key}</div>
        {description && (
          <div className="mt-1 text-[12px] leading-relaxed text-[var(--color-fg-muted)]">{description}</div>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {entry.ty === "boolean" ? (
          <Switch
            checked={value === "true"}
            onChange={(v) => {
              setValue(String(v));
              onSave(entry, String(v));
            }}
          />
        ) : entry.options?.length ? (
          <Select
            className="max-w-[240px]"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              onSave(entry, e.target.value);
            }}
          >
            {!entry.options.includes(value) && <option value={value}>{displayValue(entry.value)}</option>}
            {entry.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              mono
              className="max-w-[260px]"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && dirty && onSave(entry, value)}
            />
            {dirty && (
              <Button size="sm" variant="primary" onClick={() => onSave(entry, value)}>
                {t.common.save}
              </Button>
            )}
          </div>
        )}

        {entry.configured && (
          <IconButton
            label={t.common.reset}
            className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            onClick={onReset}
          >
            <RotateCcw size={15} strokeWidth={2.2} />
          </IconButton>
        )}
      </div>
    </div>
  );
}
