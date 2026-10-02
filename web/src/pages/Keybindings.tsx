import { useEffect, useState } from "react";
import { FolderOpen, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";

import { useApp } from "../hooks/useApp";
import { useAsync } from "../hooks/useAsync";
import { ipc } from "../lib/ipc";
import { chordFromEvent } from "../lib/chord";
import { errorText, type BindingState, type KeybindingsState } from "../lib/types";
import { toast } from "../lib/toast";
import { Badge, Banner, Button, Dialog, EmptyState, IconButton, Input, Kbd } from "../components/ui";
import { PageError, PageSkeleton } from "../components/ui/PageState";
import { PageContainer } from "../components/shell/PageContainer";

function ChordDialog({
  open,
  binding,
  onClose,
  onSaved,
}: {
  open: boolean;
  binding: BindingState | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useApp();
  const [action, setAction] = useState("");
  const [chords, setChords] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAction(binding?.action ?? "");
    setChords(binding?.chords ?? []);
    setBusy(false);
  }, [open, binding]);

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(message, action);
      onSaved();
    } catch (e) {
      toast.error(message, errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      title={binding ? binding.action : t.keybindings.addAction}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          {binding?.overridden && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => void run(() => ipc.removeKeybinding(binding.action), t.keybindings.reset)}
            >
              <RotateCcw size={14} />
              {t.keybindings.reset}
            </Button>
          )}
          <Button
            variant="primary"
            disabled={busy || action.trim().length === 0}
            onClick={() => void run(() => ipc.setKeybinding(action.trim(), chords), t.common.save)}
          >
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!binding && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] text-[var(--color-fg-muted)]">{t.keybindings.actionId}</span>
            <Input mono value={action} autoFocus onChange={(e) => setAction(e.target.value)} />
          </label>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] text-[var(--color-fg-muted)]">{t.keybindings.action}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {chords.length === 0 && <span className="text-[12px] text-[var(--color-fg-subtle)]">{t.keybindings.disabled}</span>}
            {chords.map((chord) => (
              <span key={chord} className="inline-flex items-center gap-1">
                <Kbd>{chord}</Kbd>
                <IconButton
                  label={t.common.delete}
                  onClick={() => setChords((cs) => cs.filter((c) => c !== chord))}
                >
                  <Trash2 size={13} />
                </IconButton>
              </span>
            ))}
          </div>
        </div>

        <div
          tabIndex={0}
          autoFocus={!!binding}
          onKeyDown={(e) => {
            const chord = chordFromEvent(e);
            if (!chord) return;
            e.preventDefault();
            e.stopPropagation();
            setChords((cs) => (cs.includes(chord) ? cs : [...cs, chord]));
          }}
          className="flex h-16 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-strong)] text-[12px] text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)] focus:outline-none"
        >
          {t.keybindings.recordHint}
        </div>

        <span className="text-[11px] text-[var(--color-fg-subtle)]">{t.keybindings.saveHint}</span>
      </div>
    </Dialog>
  );
}

export function Keybindings() {
  const { t } = useApp();
  const { data, loading, error, reload } = useAsync<KeybindingsState>(() => ipc.listKeybindings(), []);
  const [editing, setEditing] = useState<BindingState | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const adopt = async () => {
    setBusy(true);
    try {
      await ipc.adoptKeybindings();
      toast.success(t.keybindings.adopt, t.keybindings.title);
      reload();
    } catch (e) {
      toast.error(t.keybindings.adopt, errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      await ipc.restoreKeybindingsBackup();
      toast.success(t.common.restore, t.keybindings.title);
      reload();
    } catch (e) {
      toast.error(t.common.restore, errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <PageContainer title={t.keybindings.title} description={t.pageDesc.keybindings}>
        <PageSkeleton rows={5} />
      </PageContainer>
    );
  }

  if (error || !data) {
    return (
      <PageContainer title={t.keybindings.title} description={t.pageDesc.keybindings}>
        <PageError message={error ?? t.common.empty} onRetry={reload} />
      </PageContainer>
    );
  }

  const managed = data.link === "managed";

  const actions = (
    <>
      <Button variant="ghost" size="sm" onClick={reload}>
        <RotateCcw size={14} />
        {t.common.refresh}
      </Button>
      {managed && (
        <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
          <Plus size={14} />
          {t.keybindings.addAction}
        </Button>
      )}
      {managed && data.hasBackup && (
        <Button variant="ghost" size="sm" disabled={busy} onClick={restore}>
          <RotateCcw size={14} />
          {t.common.restore}
        </Button>
      )}
      {!managed && (
        <Button variant="primary" size="sm" disabled={busy} onClick={adopt}>
          {t.keybindings.adopt}
        </Button>
      )}
    </>
  );

  return (
    <PageContainer title={t.keybindings.title} description={t.pageDesc.keybindings} actions={actions}>
      {data.link === "unmanaged" && (
        <div className="mb-4">
          <Banner tone="warn" action={<Button size="sm" variant="primary" onClick={adopt}>{t.keybindings.adopt}</Button>}>
            {t.resources.foreignHint}
          </Banner>
        </div>
      )}

      {data.link === "absent" ? (
        <EmptyState
          title={t.keybindings.adoptHint}
          action={
            <Button size="sm" variant="primary" disabled={busy} onClick={adopt}>
              {t.keybindings.adopt}
            </Button>
          }
        />
      ) : (
        <div className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {data.bindings.map((binding) => (
            <div key={binding.action} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-[12px] text-[var(--color-fg)]">{binding.action}</span>
                  <span className="truncate text-[12px] text-[var(--color-fg-subtle)]">
                    {binding.label ?? t.keybindings.unknownAction}
                  </span>
                  {!binding.known && <Badge tone="neutral">{t.common.unknown}</Badge>}
                  {binding.disabled && <Badge tone="warn">{t.keybindings.disabled}</Badge>}
                  {binding.overridden && !binding.disabled && <Badge tone="ok">{t.keybindings.overridden}</Badge>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {binding.chords.map((chord) => (
                    <Kbd key={chord}>{chord}</Kbd>
                  ))}
                </div>
              </div>
              <IconButton label={t.keybindings.edit} disabled={!managed} onClick={() => setEditing(binding)}>
                <Pencil size={14} />
              </IconButton>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => ipc.openInFileManager(data.agentPath)}>
          <FolderOpen size={14} />
          {t.common.openFolder}
        </Button>
        <span className="truncate font-mono text-[11px] text-[var(--color-fg-subtle)]">{data.agentPath}</span>
      </div>

      <ChordDialog
        open={editing !== undefined}
        binding={editing ?? null}
        onClose={() => setEditing(undefined)}
        onSaved={() => {
          setEditing(undefined);
          reload();
        }}
      />
    </PageContainer>
  );
}
