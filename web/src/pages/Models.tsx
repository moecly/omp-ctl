import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

import { useApp } from "../hooks/useApp";
import { useAsync } from "../hooks/useAsync";
import { ipc } from "../lib/ipc";
import { errorText, type ModelRef, type Provider } from "../lib/types";
import { toast } from "../lib/toast";
import { Badge, Button, EmptyState, SearchInput, Select } from "../components/ui";
import { PageError, PageSkeleton } from "../components/ui/PageState";
import { PageContainer } from "../components/shell/PageContainer";

export function Models() {
  const { t } = useApp();
  const providers = useAsync<Provider[]>(() => ipc.listProviders(), []);
  const refs = useAsync<ModelRef[]>(() => ipc.listModelRefs(), []);
  const [query, setQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    const all = (providers.data ?? []).flatMap((p) =>
      p.models.map((m) => ({ provider: p.id, model: m })),
    );
    const q = query.trim().toLowerCase();
    return all.filter((r) => {
      if (providerFilter !== "all" && r.provider !== providerFilter) return false;
      if (!q) return true;
      return r.model.id.toLowerCase().includes(q) || (r.model.name ?? "").toLowerCase().includes(q);
    });
  }, [providers.data, query, providerFilter]);

  const defaultId = refs.data?.[0]?.id ?? "";

  const setDefault = async (selector: string) => {
    setSaving(true);
    try {
      await ipc.setDefaultModel(selector);
      toast.success(t.models.setDefault, selector);
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
        <PageError message={refs.error} onRetry={() => { providers.reload(); refs.reload(); }} />
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
          }}
        >
          <RotateCcw size={14} />
          {t.common.refresh}
        </Button>
      }
    >
      {providers.error && <PageError message={providers.error} onRetry={() => { providers.reload(); refs.reload(); }} />}

      <div className="flex items-center gap-3">
        <span className="text-[12px] text-[var(--color-fg-muted)]">{t.models.defaultModel}</span>
        <Select
          className="max-w-[320px]"
          value={defaultId}
          onChange={(e) => setDefault(e.target.value)}
          disabled={saving || !refs.data?.length}
        >
          {(refs.data ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.name ? `${r.name} — ${r.id}` : r.id}
            </option>
          ))}
        </Select>
        <span className="truncate font-mono text-[12px] text-[var(--color-fg-subtle)]">
          {(refs.data ?? []).map((r) => r.id).join(" · ") || "—"}
        </span>
      </div>

      <div className="flex gap-2">
        <div className="max-w-[280px] flex-1">
          <SearchInput value={query} onChange={setQuery} placeholder={t.common.search} />
        </div>
        <Select className="max-w-[200px]" value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)}>
          <option value="all">{t.common.none}</option>
          {(providers.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.id}
            </option>
          ))}
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={t.common.empty} />
      ) : (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="text-[11px] uppercase text-[var(--color-fg-subtle)]">
              <th className="sticky top-0 bg-[var(--color-bg)] py-2 font-medium">ID</th>
              <th className="sticky top-0 bg-[var(--color-bg)] py-2 font-medium">{t.models.provider}</th>
              <th className="sticky top-0 bg-[var(--color-bg)] py-2 font-medium">{t.common.name}</th>
              <th className="sticky top-0 bg-[var(--color-bg)] py-2 font-medium">{t.models.contextWindow}</th>
              <th className="sticky top-0 bg-[var(--color-bg)] py-2 font-medium">{t.models.maxTokens}</th>
              <th className="sticky top-0 bg-[var(--color-bg)] py-2 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {rows.map((r) => (
              <tr key={`${r.provider}/${r.model.id}`} className="h-[44px] hover:bg-[var(--color-hover)]">
                <td className="font-mono text-[12px] text-[var(--color-fg)]">{r.model.id}</td>
                <td>
                  <Badge tone="neutral">{r.provider}</Badge>
                </td>
                <td className="text-[13px] text-[var(--color-fg-muted)]">{r.model.name ?? "—"}</td>
                <td className="font-mono text-[12px] text-[var(--color-fg-subtle)]">
                  {r.model.contextWindow?.toLocaleString() ?? "—"}
                </td>
                <td className="font-mono text-[12px] text-[var(--color-fg-subtle)]">
                  {r.model.maxTokens?.toLocaleString() ?? "—"}
                </td>
                <td>
                  <div className="flex items-center justify-end gap-2">
                    {r.model.reasoning && <Badge tone="accent">{t.models.reasoning}</Badge>}
                    {r.model.imageInput && <Badge tone="neutral">{t.models.imageInput}</Badge>}
                    <Button size="sm" variant="ghost" onClick={() => setDefault(`${r.provider}/${r.model.id}`)}>
                      {t.models.setDefault}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PageContainer>
  );
}
