import { Fragment, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

import { useApp } from "../hooks/useApp";
import { useAsync } from "../hooks/useAsync";
import { ipc } from "../lib/ipc";
import { errorText, type ModelRef, type Provider } from "../lib/types";
import { toast } from "../lib/toast";

import { Badge, Button, EmptyState, SearchInput, Select } from "../components/ui";
import { cn } from "../lib/cn";
import { PageError, PageSkeleton } from "../components/ui/PageState";
import { PageContainer } from "../components/shell/PageContainer";

/** Compact thinking summary: the mode, then the level ladder. */
/**
 * Compacts the thinking config into one line for the table.
 *
 * The mode is shown only when it is not the default `effort`: repeating
 * "effort ·" on every row costs width and carries no information.
 */
function thinkingSummary(model: { thinking?: { mode?: string; efforts?: string[] } }): string {
  const own = model.thinking;
  if (!own?.efforts?.length) return "—";
  const ladder = own.efforts.join(" › ");
  return own.mode && own.mode !== "effort" ? `${own.mode} › ${ladder}` : ladder;
}

function thinkingTitle(model: { thinking?: { mode?: string; efforts?: string[] } }): string {
  const own = model.thinking;
  if (!own?.efforts?.length) return "";
  return own.mode ? `${own.mode}: ${own.efforts.join(", ")}` : own.efforts.join(", ");
}

export function Models() {
  const { t } = useApp();
  const providers = useAsync<Provider[]>(() => ipc.listProviders(), []);
  const refs = useAsync<ModelRef[]>(() => ipc.listModelRefs(), []);
  const [query, setQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    const all = (providers.data ?? []).flatMap((p) => p.models.map((m) => ({ provider: p.id, model: m })));
    const q = query.trim().toLowerCase();
    return all.filter((r) => {
      if (providerFilter !== "all" && r.provider !== providerFilter) return false;
      if (!q) return true;
      return r.model.id.toLowerCase().includes(q) || (r.model.name ?? "").toLowerCase().includes(q);
    });
  }, [providers.data, query, providerFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = map.get(r.provider);
      if (list) list.push(r);
      else map.set(r.provider, [r]);
    }
    return [...map.entries()];
  }, [rows]);

  const def = useAsync<string | null>(() => ipc.getDefaultModel(), []);
  const defaultId = def.data ?? "";

  const setDefault = async (selector: string) => {
    if (!selector.trim()) return;
    setSaving(true);
    try {
      await ipc.setDefaultModel(selector);
      toast.success(t.models.setDefault, selector);
      def.reload();
      refs.reload();
    } catch (e) {
      toast.error(t.models.setDefault, errorText(e));
    } finally {
      setSaving(false);
    }
  };

  if (providers.loading) {
    return (
      <PageContainer title={t.models.title} description={t.pageDesc.models.replace("{n}", String(providers.data?.length ?? 0))}>
        <PageSkeleton rows={5} rowHeight={36} />
      </PageContainer>
    );
  }

  if (refs.error) {
    return (
      <PageContainer title={t.models.title} description={t.pageDesc.models.replace("{n}", String(providers.data?.length ?? 0))}>
        <PageError message={refs.error} onRetry={() => { providers.reload(); refs.reload(); def.reload(); }} />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={t.models.title}
      description={t.pageDesc.models.replace("{n}", String(providers.data?.length ?? 0))}
      actions={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            providers.reload();
            refs.reload();
            def.reload();
          }}
        >
          <RotateCcw size={14} />
          {t.common.refresh}
        </Button>
      }
    >
      {providers.error && <PageError message={providers.error} onRetry={() => { providers.reload(); refs.reload(); def.reload(); }} />}
      {def.error && <PageError message={def.error} onRetry={def.reload} />}

      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-[12px] text-[var(--color-fg-muted)]">{t.models.defaultModel}</span>
        <Select
          className="w-[240px] shrink-0"
          value={defaultId}
          onChange={(e) => setDefault(e.target.value)}
          disabled={saving || !refs.data?.length}
        >
          {defaultId && !(refs.data ?? []).some((r) => r.id === defaultId) && (
            <option value={defaultId}>{defaultId}</option>
          )}
          {(refs.data ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.name ? `${r.name} — ${r.id}` : r.id}
            </option>
          ))}
        </Select>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <SearchInput value={query} onChange={setQuery} placeholder={t.common.search} className="w-[220px]" />
          <Select className="w-[160px] shrink-0" value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)}>
          <option value="all">{t.common.none}</option>
          {(providers.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.id}
            </option>
          ))}
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={t.common.empty} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.05em] text-[var(--color-fg-subtle)]">
                <th className="w-auto py-2 pr-4 font-medium">{t.models.id}</th>
                <th className="w-[88px] py-2 pr-4 font-medium">{t.common.name}</th>
                <th className="w-[92px] py-2 pr-4 text-right font-medium">{t.models.contextWindow}</th>
                <th className="w-[80px] py-2 pr-4 text-right font-medium">{t.models.maxTokens}</th>
                <th className="w-[22%] py-2 pr-4 font-medium">{t.models.thinkingLevel}</th>
                <th className="w-[148px] py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {grouped.map(([provider, group]) => (
                <Fragment key={provider}>
                  <tr>
                    <td colSpan={6} className="pb-1 pt-4 first:pt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-fg-muted)]">
                          {provider}
                        </span>
                        <span className="text-[11px] tabular-nums text-[var(--color-fg-subtle)]">{group.length}</span>
                        <span className="h-px flex-1 bg-[var(--color-border)]" />
                      </div>
                    </td>
                  </tr>
                  {group.map((r) => {
                    const selector = `${r.provider}/${r.model.id}`;
                    const isDefault = selector === defaultId;
                    return (
                      <tr
                        key={selector}
                        className={cn(
                          "group border-b border-[var(--color-border)] transition-colors duration-[var(--dur-short)] last:border-0",
                          "hover:bg-[var(--color-hover)]",
                          isDefault && "bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]",
                        )}
                      >
                        <td className="py-2.5 pr-4 font-mono text-[12px] leading-5 text-[var(--color-fg)]">
                          <span className="block truncate" title={r.model.id}>
                            {r.model.id}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-[12px] leading-5 text-[var(--color-fg-muted)]">
                          <span className="block truncate" title={r.model.name ?? ""}>
                            {r.model.name ?? "—"}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono text-[11px] tabular-nums leading-5 text-[var(--color-fg-subtle)]">
                          {r.model.contextWindow?.toLocaleString() ?? "—"}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono text-[11px] tabular-nums leading-5 text-[var(--color-fg-subtle)]">
                          {r.model.maxTokens?.toLocaleString() ?? "—"}
                        </td>
                        <td className="py-2.5 pr-4 text-[11px] leading-5 text-[var(--color-fg-subtle)]">
                          <span className="block truncate" title={thinkingTitle(r.model)}>
                            {thinkingSummary(r.model)}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            {r.model.reasoning && (
                              <span
                                title={t.models.reasoning}
                                className="rounded-full bg-[var(--color-surface-2)] px-1.5 text-[10px] font-medium leading-4 text-[var(--color-fg-subtle)]"
                              >
                                R
                              </span>
                            )}
                            {r.model.imageInput && (
                              <span
                                title={t.models.imageInput}
                                className="rounded-full bg-[var(--color-surface-2)] px-1.5 text-[10px] font-medium leading-4 text-[var(--color-fg-subtle)]"
                              >
                                IMG
                              </span>
                            )}
                            {isDefault ? (
                              <Badge tone="accent">{t.common.default}</Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="shrink-0"
                                onClick={() => setDefault(selector)}
                              >
                                {t.models.setDefault}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
