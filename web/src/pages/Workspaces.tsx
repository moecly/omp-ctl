import { useState } from "react";

import { useApp } from "../hooks/useApp";
import { useAsync } from "../hooks/useAsync";
import { ipc } from "../lib/ipc";
import { errorText } from "../lib/types";
import { relativeTime } from "../lib/format";
import { toast } from "../lib/toast";
import { Button, ConfirmDialog, Input } from "../components/ui";
import { PageContainer } from "../components/shell/PageContainer";

export function Workspaces() {
  const { t } = useApp();
  const list = useAsync(() => ipc.listWorkspaces(), []);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const doCreate = async () => {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    try {
      await ipc.createWorkspace(n);
      setName("");
      list.reload();
    } catch (e) {
      toast.error(t.workspaces.create, errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const doApply = async (n: string) => {
    setBusy(true);
    try {
      await ipc.applyWorkspace(n);
      list.reload();
    } catch (e) {
      toast.error(t.workspaces.apply, errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const doSave = async (n: string) => {
    setBusy(true);
    try {
      await ipc.saveWorkspace(n);
      list.reload();
    } catch (e) {
      toast.error(t.workspaces.save, errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await ipc.deleteWorkspace(deleting);
      list.reload();
    } catch (e) {
      toast.error(t.common.delete, errorText(e));
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  };

  const rows = list.data ?? [];
  const anyActive = rows.some((r) => r.active);

  return (
    <PageContainer
      title={t.workspaces.title}
      description={t.pageDesc.workspaces}
      actions={
        <div className="flex items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.workspaces.namePlaceholder}
          />
          <Button variant="primary" size="sm" disabled={busy || !name.trim()} onClick={doCreate}>
            {t.workspaces.create}
          </Button>
        </div>
      }
    >
      {!anyActive && !list.loading && (
        <div className="text-sm opacity-70">{t.workspaces.unselected}</div>
      )}
      {list.loading ? (
        <div className="text-sm opacity-70">{t.common.loading}</div>
      ) : list.error ? (
        <div className="text-sm text-red-500">
          {list.error}{" "}
          <Button variant="ghost" size="sm" onClick={() => list.reload()}>
            {t.common.retry}
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-sm opacity-70">{t.common.empty}</div>
      ) : (
        <div className="divide-y">
          {rows.map((w) => (
            <div key={w.name} className="flex items-center gap-3 py-2">
              <span className="font-medium">{w.name}</span>
              {w.active && (
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs text-emerald-500">
                  ●
                </span>
              )}
              <span className="text-xs opacity-60">{relativeTime(w.updatedAt)}</span>
              <span className="flex-1" />
              <Button size="sm" disabled={busy || w.active} onClick={() => doApply(w.name)}>
                {t.workspaces.apply}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => doSave(w.name)}>
                {t.workspaces.save}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => setDeleting(w.name)}
              >
                {t.common.delete}
              </Button>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={t.common.delete}
        message={deleting ?? ""}
        confirmLabel={t.common.confirm}
        onCancel={() => setDeleting(null)}
        onConfirm={doDelete}
      />
    </PageContainer>
  );
}
