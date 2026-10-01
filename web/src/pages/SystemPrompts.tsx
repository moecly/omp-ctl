import { useEffect, useState } from "react";
import { FolderOpen, RotateCcw, Save } from "lucide-react";

import { useApp } from "../hooks/useApp";
import { useAsync } from "../hooks/useAsync";
import { ipc } from "../lib/ipc";
import { errorText, type PromptState } from "../lib/types";
import { toast } from "../lib/toast";
import { cn } from "../lib/cn";
import {
  Badge,
  Banner,
  Button,
  CodeEditor,
  ConfirmDialog,
  EmptyState,
  Switch,
} from "../components/ui";
import { PageError, PageSkeleton } from "../components/ui/PageState";
import { PageContainer } from "../components/shell/PageContainer";

export function SystemPrompts() {
  const { t } = useApp();
  const { data, loading, error, reload } = useAsync<PromptState[]>(() => ipc.listPrompts(), []);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "restore" | "toggle"; prompt: PromptState } | null>(null);
  const [busy, setBusy] = useState(false);

  const current = data?.find((p) => p.key === selected) ?? null;

  useEffect(() => {
    if (!selected && data?.length) setSelected(data[0].key);
  }, [data, selected]);

  useEffect(() => {
    if (!current) return;
    setContent(current.storeContent ?? "");
    setDirty(false);
  }, [current?.key, current?.storeExists]);

  const toggle = async (p: PromptState, enabled: boolean) => {
    setBusy(true);
    try {
      const next = await ipc.setPromptEnabled(p.key, enabled);
      toast.success(enabled ? t.common.enabled : t.common.disabled, next.label);
      reload();
    } catch (e) {
      toast.error(t.common.save, errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!current) return;
    setBusy(true);
    try {
      await ipc.writePrompt(current.key, content);
      toast.success(t.prompts.saveContent, current.label);
      setDirty(false);
      reload();
    } catch (e) {
      toast.error(t.prompts.saveContent, errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <PageContainer title={t.prompts.title} description={t.pageDesc.prompts}>
        <PageSkeleton rows={5} />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer
        title={t.prompts.title}
        description={t.pageDesc.prompts}
      >
        <PageError message={error} onRetry={reload} />
      </PageContainer>
    );
  }

  if (!data?.length) {
    return (
      <PageContainer title={t.prompts.title} description={t.pageDesc.prompts}>
        <EmptyState title={t.common.empty} />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={t.prompts.title}
      description={t.pageDesc.prompts}
      actions={
        <Button variant="ghost" size="sm" onClick={reload}>
          <RotateCcw size={14} />
          {t.common.refresh}
        </Button>
      }
    >
      <div className="flex min-h-[480px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
        <div className="w-[260px] shrink-0 divide-y divide-[var(--color-border)] overflow-y-auto border-r border-[var(--color-border)]">
          {data.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setSelected(p.key)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-[var(--color-hover)]",
                p.key === selected && "bg-[var(--color-active)]",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  p.enabled ? "bg-[var(--color-accent)]" : "bg-[var(--color-border-strong)]",
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[13px] text-[var(--color-fg)]">
                  <span className="truncate">{p.label}</span>
                  {p.hasBackup && <Badge tone="warn">{t.common.backup}</Badge>}
                </div>
                <div className="truncate text-[11px] text-[var(--color-fg-subtle)]">{p.description}</div>
              </div>
              <span onClick={(e) => e.stopPropagation()}>
                <Switch
                  checked={p.enabled}
                  disabled={busy}
                  onChange={(v) => {
                    if (p.link === "unmanaged") {
                      toast.warn(p.label, t.resources.foreignHint);
                      return;
                    }
                    setConfirm({ kind: "toggle", prompt: p });
                    void v;
                  }}
                />
              </span>
            </button>
          ))}
        </div>

        {current && (
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-2.5">
              <span className="text-[13px] font-medium text-[var(--color-fg)]">{current.label}</span>
              <Badge tone={current.enabled ? "ok" : "neutral"}>
                {current.enabled ? t.common.enabled : t.common.disabled}
              </Badge>
              <Badge tone="neutral">{current.risk}</Badge>
              {dirty && <span className="text-[11px] text-[var(--color-fg-subtle)]">{t.common.dirty}</span>}
              <div className="ml-auto flex items-center gap-2">
                {current.hasBackup && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirm({ kind: "restore", prompt: current })}
                  >
                    <RotateCcw size={14} />
                    {t.common.restore}
                  </Button>
                )}
                <Button size="sm" variant="primary" disabled={busy || !dirty} onClick={save}>
                  <Save size={14} />
                  {t.prompts.saveContent}
                </Button>
              </div>
            </div>

            {current.link === "unmanaged" && (
              <div className="px-4 pt-3">
                <Banner tone="warn">{t.resources.foreignHint}</Banner>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-auto p-3">
              <CodeEditor
                value={content}
                onChange={(v) => {
                  setContent(v);
                  setDirty(true);
                }}
                rows={20}
              />
            </div>

            <div className="flex items-center gap-2 border-t border-[var(--color-border)] px-4 py-2">
              <Button size="sm" variant="ghost" onClick={() => ipc.openInFileManager(current.agentPath)}>
                <FolderOpen size={14} />
                {t.common.openFolder}
              </Button>
              <span className="truncate font-mono text-[11px] text-[var(--color-fg-subtle)]">{current.agentPath}</span>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === "restore" ? t.common.restore : t.common.confirm}
        message={
          confirm?.kind === "restore"
            ? t.prompts.restoreConfirm.replace("{name}", confirm.prompt.label)
            : confirm
              ? (confirm.prompt.enabled ? t.prompts.disableConfirm : t.prompts.enableConfirm).replace(
                  "{name}",
                  confirm.prompt.label,
                )
              : ""
        }
        confirmLabel={t.common.confirm}
        danger={confirm?.kind === "restore"}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          const c = confirm!;
          setConfirm(null);
          if (c.kind === "restore") {
            try {
              await ipc.restorePromptBackup(c.prompt.key);
              toast.success(t.common.restore, c.prompt.label);
              reload();
            } catch (e) {
              toast.error(t.common.restore, errorText(e));
            }
          } else {
            await toggle(c.prompt, !c.prompt.enabled);
          }
        }}
      />
    </PageContainer>
  );
}
