import { memo, useCallback, useRef, useState } from "react";
import { ChevronRight, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";

import { useApp } from "../hooks/useApp";
import type { Strings } from "../lib/i18n";
import { useAsync } from "../hooks/useAsync";
import { ipc } from "../lib/ipc";
import {
  errorText,
  type CatalogModel,
  type Defaults,
  type ModelEntry,
  type ModelRef,
  type Provider,
  type ProviderSummary,
  type ThinkingConfig,
} from "../lib/types";
import {
  API_PRESETS,
  THINKING_EFFORTS,
  THINKING_MODES,
  thinkingLabel,
  thinkingModeFor,
} from "../lib/modelMeta";
import { toast } from "../lib/toast";
import { cn } from "../lib/cn";
import { useRipple } from "../lib/ripple";
import { scanRows } from "../lib/scanRows";
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

/**
 * One model row inside a provider form, memoised on its own data.
 *
 * A provider with nine models renders nine of these, each with eight controls
 * and two switches. Without memoisation every keystroke in any one of them
 * re-rendered all nine (the parent's `draft` object is replaced wholesale by
 * `patch`), which is what made typing and scrolling in the expanded panel feel
 * heavy.
 */
const ModelCard = memo(function ModelCard({
  model: m,
  index: i,
  t,
  onPatch,
  onRemove,
  onOpenThinking,
  open,
  onToggle,
}: {
  model: ModelEntry;
  index: number;
  t: Strings;
  onPatch: (index: number, next: Partial<ModelEntry>) => void;
  onRemove: (index: number) => void;
  onOpenThinking: (index: number) => void;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-[var(--radius-md)] border bg-[var(--color-surface-2)] transition-colors duration-[var(--dur-short)]",
        open ? "border-[var(--color-border-strong)]" : "border-[var(--color-border)]",
      )}
    >
      {/*
       * Collapsed by default. A provider can hold nine models; rendering every
       * field of every model on open mounted ~430 nodes (30 inputs, 53 buttons)
       * in one commit, which measured 5-8 dropped frames before anything was
       * painted. The summary row is what the user scans; the form is what they
       * edit, one model at a time.
       */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left"
      >
        <ChevronRight
          size={14}
          className={cn(
            "shrink-0 text-[var(--color-fg-subtle)] transition-transform duration-[var(--dur-short)]",
            open && "rotate-90",
          )}
        />
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--color-fg)]" title={m.id}>
          {m.id || "—"}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {thinkingLabel(m.thinking?.mode, m.thinking?.efforts) && (
            <span className="hidden text-[11px] text-[var(--color-fg-subtle)] md:inline">
              {thinkingLabel(m.thinking?.mode, m.thinking?.efforts)}
            </span>
          )}
          {m.reasoning && <Badge tone="accent">{t.models.reasoning}</Badge>}
          {m.imageInput && <Badge tone="neutral">{t.models.imageInput}</Badge>}
        </span>
      </button>

      {open && (
      <div className="flex flex-col gap-3 px-3 pb-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Field label={t.common.name}>
          <Input value={m.name ?? ""} onChange={(e) => onPatch(i, { name: e.target.value || undefined })} />
        </Field>
        <Field label={t.providers.api}>
          <Select
            value={m.api && !API_PRESETS.includes(m.api) ? "__custom" : (m.api ?? "")}
            onChange={(e) => onPatch(i, { api: e.target.value === "__custom" ? m.api : e.target.value || undefined })}
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
          <Button size="sm" className="w-full justify-between font-mono text-[11px]" onClick={() => onOpenThinking(i)}>
            <span className="truncate">
              {thinkingLabel(m.thinking?.mode, m.thinking?.efforts) || t.models.thinkingDefault}
            </span>
            <Pencil size={12} />
          </Button>
        </Field>
        <Field label={t.models.contextWindow}>
          <Input
            type="number"
            min={0}
            value={m.contextWindow ?? ""}
            onChange={(e) => onPatch(i, { contextWindow: e.target.value === "" ? undefined : Number(e.target.value) })}
          />
        </Field>
        <Field label={t.models.maxTokens}>
          <Input
            type="number"
            min={0}
            value={m.maxTokens ?? ""}
            onChange={(e) => onPatch(i, { maxTokens: e.target.value === "" ? undefined : Number(e.target.value) })}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <label className="flex items-center gap-2 whitespace-nowrap text-[12px] text-[var(--color-fg-muted)]">
          <Switch checked={m.reasoning} onChange={(v) => onPatch(i, { reasoning: v })} label={t.models.reasoning} />
          {t.models.reasoning}
        </label>
        <label className="flex items-center gap-2 whitespace-nowrap text-[12px] text-[var(--color-fg-muted)]">
          <Switch
            checked={m.imageInput}
            onChange={(v) => onPatch(i, { imageInput: v })}
            label={t.models.imageInput}
          />
          {t.models.imageInput}
        </label>
        <IconButton label={t.common.delete} className="ml-auto h-8 w-8" onClick={() => onRemove(i)}>
          <Trash2 size={14} />
        </IconButton>
      </div>
      </div>
      )}
    </div>
  );
});

export function Providers({ param }: { param?: string }) {
  const { t } = useApp();
  const list = useAsync<ProviderSummary[]>(() => ipc.listProviderSummaries(), []);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [originalId, setOriginalId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { ripple, rippleTarget } = useRipple();

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
                    "group relative isolate flex cursor-pointer flex-col gap-2 overflow-hidden rounded-[var(--radius-lg)] px-3 py-3",
                    "transition-[background-color] duration-[var(--dur-medium)] ease-[var(--ease-emphasized)]",
                    "hover:bg-[var(--color-hover)]",
                    isOpen && "bg-[var(--color-active)]",
                    active === p.id && "text-[var(--color-fg)]",
                  )}
                  onClick={(e) => {
                    openEdit(p.id);
                    // The detail card renders below the row; without this it
                    // opens off-screen at the bottom of the list.
                    const row = e.currentTarget;
                    requestAnimationFrame(() => {
                      const panel = row.parentElement?.querySelector(":scope > .collapsible");
                      panel?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                    });
                  }}
                  onPointerDown={ripple}
                  ref={rippleTarget as React.Ref<HTMLDivElement>}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--color-fg)]">
                        {p.id}
                        {active === p.id && <Badge tone="accent">active</Badge>}
                      </div>
                      <div className="truncate font-mono text-[12px] text-[var(--color-fg-subtle)]">
                        {p.baseUrl || "—"}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
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
                        className="flex items-center gap-0.5 opacity-0 transition-opacity duration-[var(--dur-short)] group-hover:opacity-100 group-focus-within:opacity-100"
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
                </div>
                {isOpen && editing && (
                  <div className="collapsible">
                    <div>
                      {/*
                       * A real card: inset from the list edge, its own border and
                       * a raised surface. Previously it was a borderless block
                       * flush with the container, so the form read as page
                       * content with no margin at all.
                       */}
                      <div className="mb-3 ml-3 mr-3 mt-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-md)]">
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
                    </div>
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
  /*
   * Live mirror of `draft` for callbacks that must stay referentially stable.
   *
   * `openThinking` is memoised so `ModelCard` can be memoised, but it needs the
   * *current* model entries. Reading `draft` directly captured whichever object
   * existed when the callback was created; after `commitThinking` replaced the
   * entries, the dpenclosure still saw the old ones, so reopening the dialog
   * showed the on-disk defaults instead of the effort levels just chosen.
   */
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [busy, setBusy] = useState(false);
  const [probing, setProbing] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [fetchOpen, setFetchOpen] = useState(false);
  const [catalog, setCatalog] = useState<CatalogModel[]>([]);
  const [probedIds, setProbedIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [thinkEdit, setThinkEdit] = useState<{ index: number; config: ThinkingConfig } | null>(null);
  /*
   * Model rows expand independently.
   *
   * Collapsing one when another opens was a side effect of the first attempt at
   * trimming the mounted subtree, and it fought the user: editing two models
   * meant losing the first one's context every time. Rows still mount lazily
   * (collapsed rows are a single summary line), which is what keeps the panel
   * cheap; exclusivity was never needed for that.
   */
  const [openModels, setOpenModels] = useState<Set<string>>(() => new Set());
  /*
   * Open state follows the entry, not its position.
   *
   * Keyed by index, deleting a model shifted every later row and carried its
   * open/closed state with it — so removing row 2 while row 3 was open made row
   * 3's form appear under a different model. The id is stable, and entries with
   * a blank id (a freshly added row) get a counter so two blanks still differ.
   */
  const entryKeys = useRef<string[]>([]);
  const blankSeq = useRef(0);
  const keyFor = useCallback((m: ModelEntry, i: number) => {
    if (m.id.trim()) return `id:${m.id}`;
    if (!entryKeys.current[i]) entryKeys.current[i] = `blank:${blankSeq.current++}`;
    return entryKeys.current[i];
  }, []);

  const defaults = useAsync<Defaults>(() => ipc.getDefaults(), []);
  const refs = useAsync<ModelRef[]>(() => ipc.listModelRefs(), []);
  const md = defaults.data?.model;

  const openThinking = useCallback(async (index: number) => {
    const current = draftRef.current;
    const m = current.models[index];
    if (!m) return;
    const selector = `${originalId ?? current.id}/${m.id}`;
    let effective = refs.data?.find((r) => r.id === selector)?.thinking;
    if (!m.thinking && !effective) {
      try {
        const all = await ipc.listModelRefs();
        effective = all.find((r) => r.id === selector)?.thinking;
      } catch {
        effective = undefined;
      }
    }
    setThinkEdit({
      index,
      config: m.thinking
        ? { ...m.thinking, efforts: [...m.thinking.efforts] }
        : { mode: thinkingModeFor(m.api ?? current.api), efforts: [...(effective ?? [])] },
    });
  }, [originalId, refs.data]);

  const blankModel = (): ModelEntry =>
    ({
      id: "",
      api: md?.api || undefined,
      reasoning: md?.reasoning ?? false,
      imageInput: md?.imageInput ?? false,
      contextWindow: md?.contextWindow,
      maxTokens: md?.maxTokens,
      raw: {},
    }) as ModelEntry;

  const patch = useCallback(
    (next: Partial<Provider>) => setDraft((d) => ({ ...d, ...next })),
    [],
  );
  // Stable identity: `ModelCard` is memoised, and a fresh callback per render
  // would invalidate every card and bring the re-render storm straight back.
  const patchModel = useCallback(
    (index: number, next: Partial<ModelEntry>) =>
      setDraft((d) => ({ ...d, models: d.models.map((m, i) => (i === index ? { ...m, ...next } : m)) })),
    [],
  );
  const removeModel = useCallback(
    (index: number) => setDraft((d) => ({ ...d, models: d.models.filter((_, i) => i !== index) })),
    [],
  );

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
          reasoning: c ? c.reasoning : (md?.reasoning ?? false),
          imageInput: c ? c.imageInput : (md?.imageInput ?? false),
          contextWindow: c?.contextWindow ?? md?.contextWindow,
          maxTokens: c?.maxTokens ?? md?.maxTokens,
          raw: {},
        } as ModelEntry;
      });
    if (additions.length > 0) {
      patch({ models: [...draft.models, ...additions] });
    }
    setFetchOpen(false);
  };

  const existingIds = new Set(draft.models.map((m) => m.id));
  const { rows, staleIds } = scanRows(draft.models, catalog, probedIds);
  const selectableIds = rows.filter((r) => !existingIds.has(r.id)).map((r) => r.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.includes(id));
  const toggleAll = () =>
    setSelected((s) =>
      allSelected ? s.filter((id) => !selectableIds.includes(id)) : [...new Set([...s, ...selectableIds])],
    );

  const apiCustom = !API_PRESETS.includes(draft.api);

  const toggleEffort = (level: string) =>
    setThinkEdit((edit) => {
      if (!edit) return edit;
      const has = edit.config.efforts.includes(level);
      const efforts = has
        ? edit.config.efforts.filter((e) => e !== level)
        : THINKING_EFFORTS.filter((e) => [...edit.config.efforts, level].includes(e));
      const defaultLevel = edit.config.defaultLevel && efforts.includes(edit.config.defaultLevel)
        ? edit.config.defaultLevel
        : undefined;
      return { ...edit, config: { ...edit.config, efforts, defaultLevel } };
    });

  const commitThinking = () => {
    if (!thinkEdit) return;
    const config = thinkEdit.config;
    patchModel(thinkEdit.index, {
      thinking: config.efforts.length > 0
        ? { ...config, defaultLevel: config.defaultLevel && config.efforts.includes(config.defaultLevel) ? config.defaultLevel : undefined }
        : undefined,
    });
    setThinkEdit(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-2 text-[13px] whitespace-nowrap text-[var(--color-fg-muted)]">
          <Switch checked={draft.authNone} onChange={(v) => patch({ authNone: v })} label={t.providers.authNone} />
          {t.providers.authNone}
        </label>
        <label className="flex items-center gap-2 text-[13px] whitespace-nowrap text-[var(--color-fg-muted)]">
          <Switch
            checked={draft.disableStrictTools}
            onChange={(v) => patch({ disableStrictTools: v })}
            label={t.providers.strictTools}
          />
          {t.providers.strictTools}
        </label>
        <Button size="sm" className="ml-auto shrink-0" disabled={probing} onClick={probe}>
          {probing ? t.providers.probing : t.providers.probe}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {draft.models.map((m, i) => {
          const entryKey = keyFor(m, i);
          return (
          /*
           * Keyed by entry identity, not index. The card's own inputs stay
           * mounted across keystrokes because its `id` is edited inside the
           * card, not in this list's key.
           */
          <ModelCard
            key={entryKey}
            model={m}
            index={i}
            t={t}
            onPatch={patchModel}
            onRemove={removeModel}
            onOpenThinking={openThinking}
            open={openModels.has(entryKey)}
            onToggle={() =>
              setOpenModels((cur) => {
                const next = new Set(cur);
                if (next.has(entryKey)) next.delete(entryKey);
                else next.add(entryKey);
                return next;
              })
            }
          />
          );
        })}
        <Button
          size="sm"
          className="self-start"
          onClick={() =>
            patch({
              models: [...draft.models, blankModel()],
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
            {staleIds.size > 0 && (
              <Button
                className="mr-auto"
                onClick={() => patch({ models: draft.models.filter((m) => !staleIds.has(m.id)) })}
              >
                {t.providers.fetchRemoveStale} ({staleIds.size})
              </Button>
            )}
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
                        {r.stale && <Badge tone="warn">{t.providers.fetchStale}</Badge>}
                        {exists && !r.stale && <Badge tone="neutral">{t.providers.fetchExists}</Badge>}
                        {r.meta?.reasoning && <Badge tone="accent">{t.models.reasoning}</Badge>}
                        {r.stale && (
                          <IconButton
                            label={t.common.delete}
                            onClick={() => patch({ models: draft.models.filter((m) => m.id !== r.id) })}
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Dialog>

      <Dialog
        open={thinkEdit !== null}
        title={`${t.models.thinkingLevel} — ${draft.models[thinkEdit?.index ?? 0]?.id ?? ""}`}
        onClose={() => setThinkEdit(null)}
        footer={
          <>
            <Button onClick={() => setThinkEdit(null)}>{t.common.cancel}</Button>
            <Button variant="primary" onClick={commitThinking}>
              {t.common.save}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-[12px] text-[var(--color-fg-muted)]">{t.models.thinkingHint}</p>
        <div className="flex flex-col gap-4">
          <Field label={t.models.thinkingMode}>
            <Select
              value={thinkEdit?.config.mode ?? "effort"}
              onChange={(e) =>
                setThinkEdit((edit) =>
                  edit ? { ...edit, config: { ...edit.config, mode: e.target.value } } : edit,
                )
              }
            >
              {THINKING_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t.models.thinkingEfforts}>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {THINKING_EFFORTS.map((level) => (
                <Checkbox
                  key={level}
                  checked={thinkEdit?.config.efforts.includes(level) ?? false}
                  onChange={() => toggleEffort(level)}
                >
                  {level}
                </Checkbox>
              ))}
            </div>
          </Field>
          <Field label={t.models.thinkingDefaultLevel}>
            <Select
              value={thinkEdit?.config.defaultLevel ?? ""}
              disabled={!thinkEdit?.config.efforts.length}
              onChange={(e) =>
                setThinkEdit((edit) =>
                  edit
                    ? { ...edit, config: { ...edit.config, defaultLevel: e.target.value || undefined } }
                    : edit,
                )
              }
            >
              <option value="">{t.models.unset}</option>
              {(thinkEdit?.config.efforts ?? []).map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
