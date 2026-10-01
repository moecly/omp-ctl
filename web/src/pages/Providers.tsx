import { useState } from "react";
import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";

import { useApp } from "../hooks/useApp";
import { useAsync } from "../hooks/useAsync";
import { ipc } from "../lib/ipc";
import { errorText, type Provider, type ProviderSummary } from "../lib/types";
import { toast } from "../lib/toast";
import { cn } from "../lib/cn";
import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  Input,
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
            const isOpen = expanded === p.id && editing?.id === p.id;
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

  const patch = (next: Partial<Provider>) => setDraft((d) => ({ ...d, ...next }));

  const save = async () => {
    if (!draft.id.trim()) {
      toast.warn(t.providers.editTitle, t.providers.idHint);
      return;
    }
    setBusy(true);
    try {
      if (originalId && originalId !== draft.id) {
        await ipc.renameProvider(originalId, draft.id);
      }
      await ipc.upsertProvider(draft);
      toast.success(t.common.save, draft.id);
      onSaved();
    } catch (e) {
      toast.error(t.common.save, errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const probe = async () => {
    setProbing(true);
    try {
      const found = await ipc.probeModels(draft.baseUrl, draft.apiKey, draft.authNone);
      toast.success(t.providers.probeResult.replace("{n}", String(found.length)), found.slice(0, 4).join(", "));
    } catch (e) {
      toast.error(t.providers.probe, errorText(e));
    } finally {
      setProbing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="ID" hint={t.providers.idHint}>
          <Input mono value={draft.id} onChange={(e) => patch({ id: e.target.value })} disabled={!!originalId} />
        </Field>
        <Field label={t.providers.api}>
          <Input mono value={draft.api} onChange={(e) => patch({ api: e.target.value })} />
        </Field>
        <Field label={t.providers.baseUrl}>
          <Input mono value={draft.baseUrl} onChange={(e) => patch({ baseUrl: e.target.value })} />
        </Field>
        <Field label={t.providers.apiKey}>
          <Input
            mono
            type="password"
            value={draft.apiKey}
            disabled={draft.authNone}
            onChange={(e) => patch({ apiKey: e.target.value })}
          />
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

      <div className="flex items-center justify-end gap-2">
        <Button onClick={onClose}>{t.common.cancel}</Button>
        <Button variant="primary" disabled={busy} onClick={save}>
          {t.common.save}
        </Button>
      </div>
    </div>
  );
}
