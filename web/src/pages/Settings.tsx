import { useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

import { useApp } from "../hooks/useApp";
import { useAsync } from "../hooks/useAsync";
import { ipc } from "../lib/ipc";
import { errorText, type SettingEntry, type SettingsCatalog } from "../lib/types";
import { displayValue, toSettingInput } from "../lib/format";
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

export function Settings() {
  const { t } = useApp();
  const catalog = useAsync<SettingsCatalog>(() => ipc.listSettings(), []);
  const [tab, setTab] = useState("");
  const [query, setQuery] = useState("");
  const [resetting, setResetting] = useState<SettingEntry | null>(null);

  useEffect(() => {
    if (catalog.data?.tabs.length && !tab) setTab(catalog.data.tabs[0]);
  }, [catalog.data, tab]);

  const entries = catalog.data?.entries ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (q) return e.key.toLowerCase().includes(q) || e.description.toLowerCase().includes(q);
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

  if (catalog.loading) {
    return (
      <PageContainer title={t.settings.title} description={t.pageDesc.settings.replace("{n}", "…")}>
        <PageSkeleton rows={6} rowHeight={36} />
      </PageContainer>
    );
  }

  if (catalog.error) {
    return (
      <PageContainer
        title={t.settings.title}
        description={t.pageDesc.settings.replace("{n}", "…")}
      >
        <PageError message={catalog.error} onRetry={catalog.reload} />
      </PageContainer>
    );
  }

  if (!catalog.data?.tabs.length) {
    return (
      <PageContainer title={t.settings.title} description={t.pageDesc.settings.replace("{n}", "0")}>
        <EmptyState title={t.common.empty} />
      </PageContainer>
    );
  }

  const tabs = catalog.data.tabs;

  return (
    <PageContainer
      title={t.settings.title}
      description={t.pageDesc.settings.replace("{n}", String(entries.length))}
      actions={
        <Button variant="ghost" size="sm" onClick={catalog.reload}>
          <RotateCcw size={14} />
          {t.common.refresh}
        </Button>
      }
    >
      <div className="flex gap-6">
        <div className="flex w-[180px] shrink-0 flex-col gap-0.5">
          {tabs.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                setQuery("");
              }}
              className={cn(
                "flex h-[30px] items-center rounded-[var(--radius-md)] px-2 text-left text-[13px]",
                !query && id === tab
                  ? "bg-[var(--color-active)] text-[var(--color-fg)]"
                  : "text-[var(--color-fg-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]",
              )}
            >
              {id}
            </button>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="max-w-[320px]">
            <SearchInput value={query} onChange={setQuery} placeholder={t.common.search} />
          </div>

          {filtered.length === 0 ? (
            <EmptyState title={t.common.empty} />
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {filtered.map((entry) => (
                <SettingRow key={entry.key} entry={entry} onSave={save} onReset={() => setResetting(entry)} />
              ))}
            </div>
          )}
        </div>
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

function SettingRow({
  entry,
  onSave,
  onReset,
}: {
  entry: SettingEntry;
  onSave: (entry: SettingEntry, raw: string) => void;
  onReset: () => void;
}) {
  const { t } = useApp();
  const [value, setValue] = useState(() => toSettingInput(entry.value));

  useEffect(() => {
    setValue(toSettingInput(entry.value));
  }, [entry.value]);

  const dirty = value !== toSettingInput(entry.value);

  return (
    <div className="group flex h-[44px] items-center gap-3 px-1 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px] text-[var(--color-fg)]">{entry.key}</span>
          <Badge tone="neutral">{entry.ty}</Badge>
          {entry.configured && <Badge tone="ok">{t.settings.configured}</Badge>}
          {entry.options?.length ? (
            <span className="text-[11px] text-[var(--color-fg-subtle)]">{t.settings.enumHint}</span>
          ) : null}
          {(entry.ty === "array" || entry.ty === "record") && (
            <span className="truncate font-mono text-[11px] text-[var(--color-fg-subtle)]">
              {displayValue(entry.value)}
            </span>
          )}
        </div>
        <div className="truncate text-[11px] text-[var(--color-fg-subtle)]">{entry.description}</div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
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
              className="max-w-[280px]"
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
          <IconButton label={t.common.reset} className="opacity-0 group-hover:opacity-100" onClick={onReset}>
            <RotateCcw size={14} />
          </IconButton>
        )}
      </div>
    </div>
  );
}
