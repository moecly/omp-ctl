import { useState } from "react";
import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";

import { useApp } from "../hooks/useApp";
import { useAsync } from "../hooks/useAsync";
import { ipc } from "../lib/ipc";
import { errorText, type CatalogModel, type ModelEntry, type Provider, type ProviderSummary } from "../lib/types";
import { toast } from "../lib/toast";
import { cn } from "../lib/cn";
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  Select,
  Switch,
} from "../components/ui";
import { PageError, PageSkeleton } from "../components/ui/PageState";
import { PageContainer } from "../components/shell/PageContainer";

const BLANK: Provider = {
  id: "",
  baseUrl: "",
  api: "anthropic-messages",
  apiKey: "",
  authNone: false,
  disableStrictTools: false,
  models: [],
  raw: {},
};

const API_PRESETS = ["anthropic-messages", "openai-chat", "openai-responses", "google-gemini"];

const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max", "auto"];

export function Providers({ param }: { param?: string }) {
  const { t } = useApp();
  const list = useAsync<ProviderSummary[]>(() => ipc.listProviderSummaries(), []);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [originalId, setOriginalId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const openNew = () => {
    setEditing({ ...BLANK });
    setOriginalId(null);
  };

  const openEdit = async (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    try {
      const p = await ipc.getProvider(id);
      if (!p) return;
      setExpanded(id);
      setEditing(p);
      setOriginalId(id);
    } catch (e) {
      toast.error(t.providers.editTitle, errorText(e));
    }
  };

  const providers = list.data ?? [];
  const active = param ?? null;

  return (
    <PageContainer
      title={t.providers.title}
      description={t.pageDesc.providers}
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={list.reload}>
            <RotateCcw size={14} />
            {t.common.refresh}
          </Button>
          <Button variant="primary" size="sm" onClick={openNew}>
            <Plus size={14} />
            {t.providers.add}
          </Button>
        </>
      }
    >
      {list.error && <PageError message={list.error} onRetry={list.reload} />}

      {list.loading ? (
        <PageSkeleton rows={5} />
      ) : providers.length === 0 ? (
        <EmptyState
          title={t.common.empty}
          action={
            <Button variant="primary" size="sm" onClick={openNew}>
              <Plus size={14} />
              {t.providers.add}
            </Button>
          }
        />
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {providers.map((p) => {
            const isOpen = expanded === p.id && originalId === p.id && editing !== null;
            return (
              <div key={p.id}>
                <div
                  className={cn(
                    "group flex min-h-[44px] cursor-pointer items-center gap-3 px-1 py-2.5 hover:bg-[var(--color-hover)]",
                    active === p.id && "text-[var(--color-fg)]",
                  )}
                  onClick={() => openEdit(p.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--color-fg)]">
                      {p.id}
                      {active === p.id && <Badge tone="accent">active</Badge>}
                    </div>
                    <div className="truncate font-mono text-[12px] text-[var(--color-fg-subtle)]">
                      {p.baseUrl || "—"}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone="neutral">{p.api || "—"}</Badge>
                    <Badge tone="neutral">
                      {t.providers.modelCount}: {p.modelCount}
                    </Badge>
                    <Badge tone={p.hasApiKey || p.authNone ? "ok" : "warn"}>
                      {p.authNone
                        ? t.providers.authNone
                        : p.hasApiKey
                          ? t.providers.apiKeySet
                          : t.providers.apiKeyMissing}
                    </Badge>
                    <div
                      className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <IconButton label={t.common.edit} onClick={() => openEdit(p.id)}>
                        <Pencil size={14} />
                      </IconButton>
                      <IconButton label={t.common.delete} onClick={() => setDeleting(p.id)}>
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  </div>
                </div>
                {isOpen && editing && (
                  <div className="mb-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
                    <ProviderForm
                      provider={editing}
                      originalId={originalId}
                      onClose={() => {
                        setExpanded(null);
                        setEditing(null);
                      }}
                      onSaved={() => {
                        setExpanded(null);
                        setEditing(null);
                        list.reload();
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing && !originalId && (
        <Dialog open title={t.providers.newTitle} onClose={() => setEditing(null)} wide>
          <ProviderForm
            provider={editing}
            originalId={null}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              list.reload();
            }}
          />
        </Dialog>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={t.common.delete}
        message={t.providers.deleteConfirm.replace("{id}", deleting ?? "")}
        confirmLabel={t.common.delete}
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          const id = deleting!;
          setDeleting(null);
          try {
            await ipc.deleteProvider(id);
            toast.success(t.common.delete, id);
            list.reload();
          } catch (e) {
            toast.error(t.common.delete, errorText(e));
          }
        }}
      />
    </PageContainer>
  );
}

function ProviderForm({
  provider,
  originalId,
  onClose,
  onSaved,
}: {
  provider: Provider;
  originalId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useApp();
  const [draft, setDraft] = useState<Provider>(provider);
  const [busy, setBusy] = useState(false);
  const [probing, setProbing] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [fetchOpen, setFetchOpen] = useState(false);
  const [catalog, setCatalog] = useState<CatalogModel[]>([]);
  const [probedIds, setProbedIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  const patch = (next: Partial<Provider>) => setDraft((d) => ({ ...d, ...next }));
  const patchModel = (index: number, next: Partial<ModelEntry>) =>
    setDraft((d) => ({ ...d, models: d.models.map((m, i) => (i === index ? { ...m, ...next } : m)) }));

  const save = async () => {
    const id = draft.id.trim();
    if (!id) {
      toast.warn(t.providers.editTitle, t.providers.idHint);
      return;
    }
    setBusy(true);
    try {
      if (originalId && originalId !== id) {
        await ipc.renameProvider(originalId, id);
      }
      await ipc.upsertProvider({ ...draft, id });
      toast.success(t.common.save, id);
      onSaved();
    } catch (e) {
      toast.error(t.common.save, errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const probe = async () => {
    const providerId = originalId ?? draft.id.trim();
    if (!providerId) {
      toast.warn(t.providers.probe, t.providers.probeNoId);
      return;
    }
    setProbing(true);
    try {
      const found = await ipc.probeModels(draft.baseUrl, draft.apiKey, draft.authNone);
      let meta: CatalogModel[] = [];
      try {
        meta = await ipc.catalogModels(providerId);
      } catch (e) {
        toast.error(t.providers.probe, errorText(e));
        return;
      }
      setProbedIds(found);
      setCatalog(meta);
      setSelected([]);
      setFetchOpen(true);
    } catch (e) {
      toast.error(t.providers.probe, errorText(e));
    } finally {
      setProbing(false);
    }
  };

  const toggleSelect = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));


  const addSelected = () => {
    const byId = new Map(catalog.map((c) => [c.id, c]));
    const existing = new Set(draft.models.map((m) => m.id));
    const additions: ModelEntry[] = selected
      .filter((id) => !existing.has(id))
      .map((id) => {
        const c = byId.get(id);
        return {
          id,
          name: c?.name,
          api: undefined,
          reasoning: c?.reasoning ?? false,
          imageInput: c?.imageInput ?? false,
          contextWindow: c?.contextWindow,
          maxTokens: c?.maxTokens,
          thinkingLevel: c?.thinking?.[0],
          raw: {},
        } as ModelEntry;
      });
    if (additions.length > 0) {
      patch({ models: [...draft.models, ...additions] });
    }
    setFetchOpen(false);
  };

  const rows: { id: string; meta?: CatalogModel }[] = (() => {
    const seen = new Set<string>();
    const out: { id: string; meta?: CatalogModel }[] = [];
    for (const c of catalog) {
      seen.add(c.id);
      out.push({ id: c.id, meta: c });
    }
    for (const id of probedIds) {
      if (!seen.has(id)) out.push({ id });
    }
    return out;
  })();
  const existingIds = new Set(draft.models.map((m) => m.id));
  const selectableIds = rows.filter((r) => !existingIds.has(r.id)).map((r) => r.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.includes(id));
  const toggleAll = () =>
    setSelected((s) =>
      allSelected ? s.filter((id) => !selectableIds.includes(id)) : [...new Set([...s, ...selectableIds])],
    );

  const apiCustom = !API_PRESETS.includes(draft.api);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="ID" hint={originalId ? t.providers.renameHint : t.providers.idHint}>
          <Input mono value={draft.id} onChange={(e) => patch({ id: e.target.value })} />
        </Field>
        <Field label={t.providers.api}>
          <Select
            value={apiCustom ? "custom" : draft.api}
            onChange={(e) => patch({ api: e.target.value === "custom" ? "" : e.target.value })}
          >
            {API_PRESETS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            <option value="custom">{t.providers.apiCustom}</option>
          </Select>
          {apiCustom && (
            <Input
              mono
              className="mt-2"
              placeholder={t.providers.apiCustomPlaceholder}
              value={draft.api}
              onChange={(e) => patch({ api: e.target.value })}
            />
          )}
        </Field>
        <Field label={t.providers.baseUrl}>
          <Input mono value={draft.baseUrl} onChange={(e) => patch({ baseUrl: e.target.value })} />
        </Field>
        <Field label={t.providers.apiKey}>
          <div className="flex items-center gap-2">
            <Input
              mono
              type={showKey ? "text" : "password"}
              value={draft.apiKey}
              disabled={draft.authNone}
              onChange={(e) => patch({ apiKey: e.target.value })}
            />
            <Button size="sm" variant="ghost" onClick={() => setShowKey((v) => !v)}>
              {showKey ? t.common.hide : t.common.show}
            </Button>
          </div>
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <Switch checked={draft.authNone} onChange={(v) => patch({ authNone: v })} label={t.providers.authNone} />
        <span className="text-[13px] text-[var(--color-fg-muted)]">{t.providers.authNone}</span>
        <Switch
          checked={draft.disableStrictTools}
          onChange={(v) => patch({ disableStrictTools: v })}
          label={t.providers.strictTools}
        />
        <span className="text-[13px] text-[var(--color-fg-muted)]">{t.providers.strictTools}</span>
        <Button size="sm" className="ml-auto" disabled={probing} onClick={probe}>
          {probing ? t.providers.probing : t.providers.probe}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {draft.models.map((m, i) => (
          <div
            key={`${m.id}-${i}`}
            className="grid grid-cols-[1fr_1fr_110px_110px] items-end gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] p-2"
          >
            <Field label="ID">
              <span className="font-mono text-[12px] text-[var(--color-fg)]">{m.id || "—"}</span>
            </Field>
            <Field label={t.common.name}>
              <Input value={m.name ?? ""} onChange={(e) => patchModel(i, { name: e.target.value || undefined })} />
            </Field>
            <Field label={t.models.contextWindow}>
              <Input
                type="number"
                min={0}
                value={m.contextWindow ?? ""}
                onChange={(e) =>
                  patchModel(i, { contextWindow: e.target.value === "" ? undefined : Number(e.target.value) })
                }
              />
            </Field>
            <Field label={t.models.maxTokens}>
              <Input
                type="number"
                min={0}
                value={m.maxTokens ?? ""}
                onChange={(e) =>
                  patchModel(i, { maxTokens: e.target.value === "" ? undefined : Number(e.target.value) })
                }
              />
            </Field>
            <Field label={t.providers.api}>
              <Select
                value={m.api && !API_PRESETS.includes(m.api) ? "__custom" : (m.api ?? "")}
                onChange={(e) =>
                  patchModel(i, { api: e.target.value === "__custom" ? m.api : e.target.value || undefined })
                }
              >
                <option value="">{t.models.unset}</option>
                {API_PRESETS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
                {m.api && !API_PRESETS.includes(m.api) && <option value="__custom">{m.api}</option>}
              </Select>
            </Field>
            <Field label={t.models.thinkingLevel}>
              <Select
                value={m.thinkingLevel ?? ""}
                onChange={(e) => patchModel(i, { thinkingLevel: e.target.value || undefined })}
              >
                <option value="">{t.models.unset}</option>
                {THINKING_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-center gap-3 pb-1">
              <Switch checked={m.reasoning} onChange={(v) => patchModel(i, { reasoning: v })} label={t.models.reasoning} />
              <span className="text-[12px] text-[var(--color-fg-muted)]">{t.models.reasoning}</span>
              <Switch
                checked={m.imageInput}
                onChange={(v) => patchModel(i, { imageInput: v })}
                label={t.models.imageInput}
              />
              <span className="text-[12px] text-[var(--color-fg-muted)]">{t.models.imageInput}</span>
            </div>
            <div className="flex justify-end pb-1">
              <IconButton
                label={t.common.delete}
                onClick={() => patch({ models: draft.models.filter((_, j) => j !== i) })}
              >
                <Trash2 size={14} />
              </IconButton>
            </div>
          </div>
        ))}
        <Button
          size="sm"
          className="self-start"
          onClick={() =>
            patch({
              models: [
                ...draft.models,
                { id: "", reasoning: false, imageInput: false, raw: {} } as ModelEntry,
              ],
            })
          }
        >
          <Plus size={14} />
          {t.common.add}
        </Button>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button onClick={onClose}>{t.common.cancel}</Button>
        <Button variant="primary" disabled={busy} onClick={save}>
          {t.common.save}
        </Button>
      </div>

      <Dialog
        open={fetchOpen}
        title={t.providers.fetchTitle}
        onClose={() => setFetchOpen(false)}
        wide
        footer={
          <>
            <Button onClick={() => setFetchOpen(false)}>{t.common.cancel}</Button>
            <Button variant="primary" disabled={selected.length === 0} onClick={addSelected}>
              {t.providers.fetchAdd} ({selected.length})
            </Button>
          </>
        }
      >
        {rows.length === 0 ? (
          <EmptyState title={t.common.empty} />
        ) : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="text-[11px] uppercase text-[var(--color-fg-subtle)]">
                <th className="w-8 py-2">
                  <Checkbox
                    checked={allSelected}
                    disabled={selectableIds.length === 0}
                    onChange={toggleAll}
                  >
                    <span className="sr-only">{t.providers.selectAll}</span>
                  </Checkbox>
                </th>
                <th className="py-2 font-medium">ID</th>
                <th className="py-2 font-medium">{t.common.name}</th>
                <th className="py-2 font-medium">{t.models.contextWindow}</th>
                <th className="py-2 font-medium">{t.models.maxTokens}</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {rows.map((r) => {
                const exists = existingIds.has(r.id);
                return (
                  <tr key={r.id} className="h-[40px] hover:bg-[var(--color-hover)]">
                    <td>
                      <Checkbox
                        checked={selected.includes(r.id)}
                        disabled={exists}
                        onChange={() => toggleSelect(r.id)}
                      >
                        <span className="sr-only">{r.id}</span>
                      </Checkbox>
                    </td>
                    <td className="font-mono text-[12px] text-[var(--color-fg)]">{r.id}</td>
                    <td className="text-[13px] text-[var(--color-fg-muted)]">{r.meta?.name ?? "—"}</td>
                    <td className="font-mono text-[12px] text-[var(--color-fg-subtle)]">
                      {r.meta?.contextWindow?.toLocaleString() ?? "—"}
                    </td>
                    <td className="font-mono text-[12px] text-[var(--color-fg-subtle)]">
                      {r.meta?.maxTokens?.toLocaleString() ?? "—"}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        {exists && <Badge tone="neutral">{t.providers.fetchExists}</Badge>}
                        {r.meta?.reasoning && <Badge tone="accent">{t.models.reasoning}</Badge>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Dialog>
    </div>
  );
}
