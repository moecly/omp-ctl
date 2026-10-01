import { useEffect, useMemo, useState } from "react";
import { FolderOpen, Plus, RotateCcw, Save, Trash2 } from "lucide-react";

import { useApp } from "../hooks/useApp";
import { useAsync } from "../hooks/useAsync";
import { ipc } from "../lib/ipc";
import { errorText, type ResourceEntry, type ResourceId } from "../lib/types";
import { bytes, relativeTime } from "../lib/format";
import { toast } from "../lib/toast";
import { cn } from "../lib/cn";
import {
  Badge,
  Banner,
  Button,
  CodeEditor,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  SearchInput,
  Select,
  Switch,
} from "../components/ui";
import { PageError, PageSkeleton } from "../components/ui/PageState";
import { PageContainer } from "../components/shell/PageContainer";

function resourceLabel(resource: ResourceId, t: { nav: Record<string, string> }): string {
  if (resource === "hooks_pre" || resource === "hooks_post") return t.nav.hooks;
  return t.nav[resource] ?? resource;
}

export function Resources({ resource }: { resource: ResourceId }) {
  const { t } = useApp();
  const list = useAsync<ResourceEntry[]>(() => ipc.listResources(resource), [resource]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "delete" | "restore" | "adopt" | "default"; entry: ResourceEntry } | null>(null);

  const entries = list.data ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.name.toLowerCase().includes(q));
  }, [entries, query]);

  useEffect(() => {
    if (selected && !entries.some((e) => e.name === selected)) setSelected(null);
  }, [entries, selected]);

  const current = entries.find((e) => e.name === selected) ?? null;

  const mutate = async (fn: () => Promise<unknown>, okMsg: string) => {
    try {
      await fn();
      toast.success(okMsg);
      list.reload();
    } catch (e) {
      toast.error(okMsg, errorText(e));
    }
  };

  const subPath = resource.replace("_pre", "/pre").replace("_post", "/post");

  return (
    <PageContainer
      title={resourceLabel(resource, t)}
      description={t.pageDesc.agentDir.replace("{sub}", subPath)}
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={list.reload}>
            <RotateCcw size={14} />
            {t.common.refresh}
          </Button>
          {resource === "agents" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => mutate(() => ipc.unpackBundledAgents(), t.resources.reimportMissing)}
            >
              {t.resources.reimportMissing}
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
            <Plus size={14} />
            {t.common.create}
          </Button>
        </>
      }
    >
      {list.error && <PageError message={list.error} onRetry={list.reload} />}

      {list.loading ? (
        <PageSkeleton rows={5} />
      ) : entries.length === 0 ? (
        <EmptyState
          title={t.common.empty}
          action={
            <div className="flex items-center gap-2">
              <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                <Plus size={14} />
                {t.common.create}
              </Button>
              {resource === "agents" && (
                <Button
                  size="sm"
                  onClick={() => mutate(() => ipc.unpackBundledAgents(), t.resources.unpack)}
                >
                  {t.resources.unpack}
                </Button>
              )}
            </div>
          }
        />
      ) : (
        <div className="flex min-h-[480px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          <div className="flex w-[260px] shrink-0 flex-col border-r border-[var(--color-border)]">
            <div className="border-b border-[var(--color-border)] p-3">
              <SearchInput value={query} onChange={setQuery} placeholder={t.common.search} />
            </div>
            <div className="min-h-0 flex-1 divide-y divide-[var(--color-border)] overflow-y-auto">
              {filtered.map((e) => (
                <button
                  key={e.name}
                  type="button"
                  onClick={() => setSelected(e.name)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-[var(--color-hover)]",
                    e.name === selected && "bg-[var(--color-active)]",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[13px] text-[var(--color-fg)]">
                      <span className="truncate">{e.name}</span>
                      {e.foreign && <Badge tone="warn">{t.common.foreign}</Badge>}
                    </div>
                    <div className="truncate text-[11px] text-[var(--color-fg-subtle)]">{e.summary ?? e.storePath}</div>
                  </div>
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      (resource === "agents" ? !e.agentDisabled : e.enabled)
                        ? "bg-[var(--color-accent)]"
                        : "bg-[var(--color-border-strong)]",
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          {current ? (
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-2.5">
                <span className="text-[13px] font-medium text-[var(--color-fg)]">{current.name}</span>
                <Badge tone={(resource === "agents" ? !current.agentDisabled : current.enabled) ? "ok" : "neutral"}>
                  {(resource === "agents" ? !current.agentDisabled : current.enabled) ? t.common.enabled : t.common.disabled}
                </Badge>
                <div className="ml-auto flex items-center gap-0.5">
                  {resource === "agents" && current.bundled && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirm({ kind: "default", entry: current })}
                    >
                      {t.resources.restoreDefault}
                    </Button>
                  )}
                  {current.hasBackup && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirm({ kind: "restore", entry: current })}
                    >
                      <RotateCcw size={14} />
                      {t.common.restore}
                    </Button>
                  )}
                  <IconButton label={t.common.openFolder} onClick={() => ipc.openInFileManager(current.agentPath)}>
                    <FolderOpen size={15} />
                  </IconButton>
                  <IconButton label={t.common.delete} onClick={() => setConfirm({ kind: "delete", entry: current })}>
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              </div>

              {current.foreign && (
                <div className="px-4 pt-3">
                  <Banner
                    tone="warn"
                    action={
                      <Button size="sm" onClick={() => setConfirm({ kind: "adopt", entry: current })}>
                        {t.common.adopt}
                      </Button>
                    }
                  >
                    {t.resources.foreignHint}
                  </Banner>
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-auto p-3">
                {resource === "agents" && current && <AgentSettings entry={current} onChanged={list.reload} />}
                <EntryEditor
                  resource={resource}
                  name={current.name}
                  disabled={current.foreign}
                  onSaved={list.reload}
                />
              </div>

              <div className="flex items-center gap-3 border-t border-[var(--color-border)] px-4 py-2">
                <Switch
                  checked={resource === "agents" ? !current.agentDisabled : current.enabled}
                  disabled={current.foreign}
                  label={t.common.enabled}
                  onChange={(v) => mutate(() => ipc.setResourceEnabled(resource, current.name, v), t.common.save)}
                />
                <span className="text-[12px] text-[var(--color-fg-muted)]">
                  {(resource === "agents" ? !current.agentDisabled : current.enabled) ? t.common.enabled : t.common.disabled}
                </span>
                <span className="ml-auto font-mono text-[11px] text-[var(--color-fg-subtle)]">
                  {bytes(current.size)} · {relativeTime(current.modified)}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState title={t.common.empty} desc={t.resources.editorHint} />
            </div>
          )}
        </div>
      )}

      {creating && (
        <CreateDialog
          resource={resource}
          onClose={() => setCreating(false)}
          onCreated={(name) => {
            setCreating(false);
            setSelected(name);
            list.reload();
          }}
        />
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.kind === "delete"
            ? t.common.delete
            : confirm?.kind === "default"
              ? t.resources.restoreDefault
              : confirm?.kind === "restore"
                ? t.common.restore
                : t.common.adopt
        }
        message={
          !confirm
            ? ""
            : confirm.kind === "delete"
              ? t.resources.deleteConfirm.replace("{name}", confirm.entry.name)
              : confirm.kind === "default"
                ? t.resources.restoreDefaultConfirm.replace("{name}", confirm.entry.name)
                : confirm.kind === "restore"
                  ? t.resources.restoreConfirm.replace("{name}", confirm.entry.name)
                  : t.resources.attachConfirm.replace("{name}", confirm.entry.name)
        }
        confirmLabel={confirm?.kind === "delete" ? t.common.delete : t.common.confirm}
        danger={confirm?.kind === "delete"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const c = confirm!;
          setConfirm(null);
          if (c.kind === "delete") void mutate(() => ipc.deleteResource(resource, c.entry.name), t.common.delete);
          else if (c.kind === "default")
            void mutate(() => ipc.restoreAgentDefault(c.entry.name), t.resources.restoreDefault);
          else if (c.kind === "restore")
            void mutate(() => ipc.restoreResource(resource, c.entry.name), t.common.restore);
          else void mutate(() => ipc.adoptResource(resource, c.entry.name), t.common.adopt);
        }}
      />
    </PageContainer>
  );
}

function AgentSettings({ entry, onChanged }: { entry: ResourceEntry; onChanged: () => void }) {
  const { t } = useApp();
  const refs = useAsync<string[]>(() => ipc.listModelRefs().then((r) => r.map((m) => m.id)), [entry.name]);
  const model = entry.agentModel ?? "";
  const update = async (selector: string) => {
    try {
      await ipc.setAgentModel(entry.name, selector);
      toast.success(t.common.save, entry.name);
      onChanged();
    } catch (e) {
      toast.error(t.common.save, errorText(e));
    }
  };
  const options = refs.data ?? [];
  return (
    <div className="mb-3">
      <Field label={t.resources.agentModel}>
        <Select
          className="min-w-[240px]"
          value={options.includes(model) ? model : ""}
          onChange={(e) => update(e.target.value)}
        >
          <option value="">{model ? `${t.models.unset} (${model})` : t.models.unset}</option>
          {options.filter((s) => s !== model).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

function EntryEditor({
  resource,
  name,
  disabled,
  onSaved,
}: {
  resource: string;
  name: string;
  disabled: boolean;
  onSaved: () => void;
}) {
  const { t } = useApp();
  const [content, setContent] = useState("");
  const [original, setOriginal] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    ipc
      .readResource(resource, name)
      .then((text) => {
        if (!alive) return;
        setContent(text);
        setOriginal(text);
      })
      .catch((e) => alive && setError(errorText(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [resource, name]);

  const dirty = content !== original;

  if (loading) {
    return <PageSkeleton rows={6} rowHeight={20} />;
  }
  if (error) return <PageError message={error} />;

  return (
    <div className="flex flex-col gap-3">
      <CodeEditor value={content} onChange={setContent} rows={16} readOnly={disabled} />
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={disabled || !dirty}
          onClick={async () => {
            try {
              await ipc.writeResource(resource, name, content);
              setOriginal(content);
              toast.success(t.common.save, name);
              onSaved();
            } catch (e) {
              toast.error(t.common.save, errorText(e));
            }
          }}
        >
          <Save size={14} />
          {t.common.save}
        </Button>
        <Button size="sm" variant="ghost" disabled={!dirty} onClick={() => setContent(original)}>
          {t.common.reset}
        </Button>
        {dirty && <span className="text-[11px] text-[var(--color-fg-subtle)]">{t.common.dirty}</span>}
      </div>
    </div>
  );
}

function CreateDialog({
  resource,
  onClose,
  onCreated,
}: {
  resource: string;
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const { t } = useApp();
  const [name, setName] = useState("");
  const [content, setContent] = useState("---\ndescription: \n---\n\n");
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open
      wide
      title={t.resources.createPrompt}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button
            variant="primary"
            disabled={busy || !name.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await ipc.writeResource(resource, name.trim(), content);
                toast.success(t.common.create, name.trim());
                onCreated(name.trim());
              } catch (e) {
                toast.error(t.common.create, errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t.common.create}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t.common.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-entry" />
        </Field>
        <Field label={t.prompts.content} hint={t.resources.editorHint}>
          <CodeEditor value={content} onChange={setContent} rows={12} />
        </Field>
      </div>
    </Dialog>
  );
}
