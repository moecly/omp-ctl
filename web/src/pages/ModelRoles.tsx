import { useEffect, useState } from "react";
import { Check, Plus, RotateCcw, Trash2 } from "lucide-react";

import { useApp } from "../hooks/useApp";
import { useAsync } from "../hooks/useAsync";
import { ipc } from "../lib/ipc";
import { errorText, type ModelRef, type ModelRoles as ModelRolesData } from "../lib/types";
import { toast } from "../lib/toast";
import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  Select,
} from "../components/ui";
import { PageError, PageSkeleton } from "../components/ui/PageState";
import { PageContainer } from "../components/shell/PageContainer";

export function ModelRoles() {
  const { t } = useApp();
  const roles = useAsync<ModelRolesData>(() => ipc.listModelRoles(), []);
  const refs = useAsync<ModelRef[]>(() => ipc.listModelRefs(), []);

  const [newRole, setNewRole] = useState("");
  const [newSelector, setNewSelector] = useState("");
  const [creating, setCreating] = useState(false);
  const [cycle, setCycle] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (roles.data) setCycle(roles.data.cycleOrder.join(", "));
  }, [roles.data]);

  const selectors = (refs.data ?? []).map((r) => r.id);

  const create = async () => {
    if (!newRole.trim() || !newSelector.trim()) return;
    try {
      await ipc.setModelRole(newRole.trim(), newSelector.trim());
      toast.success(t.common.save, newRole.trim());
      setNewRole("");
      setNewSelector("");
      setCreating(false);
      roles.reload();
    } catch (e) {
      toast.error(t.common.save, errorText(e));
    }
  };

  const update = async (role: string, selector: string) => {
    try {
      await ipc.setModelRole(role, selector);
      toast.success(t.common.save, role);
      roles.reload();
    } catch (e) {
      toast.error(t.common.save, errorText(e));
    }
  };

  const saveCycle = async () => {
    const order = cycle
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await ipc.setCycleOrder(order);
      toast.success(t.roles.cycleOrder, order.join(" → "));
      roles.reload();
    } catch (e) {
      toast.error(t.roles.cycleOrder, errorText(e));
    }
  };

  const entries = Object.entries(roles.data?.roles ?? {});

  return (
    <PageContainer
      title={t.roles.title}
      description={t.pageDesc.roles}
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={roles.reload}>
            <RotateCcw size={14} />
            {t.common.refresh}
          </Button>
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
            <Plus size={14} />
            {t.roles.add}
          </Button>
        </>
      }
    >
      {roles.error && <PageError message={roles.error} onRetry={roles.reload} />}
      {refs.error && <PageError message={refs.error} onRetry={refs.reload} />}

      {roles.loading ? (
        <PageSkeleton rows={4} />
      ) : entries.length === 0 ? (
        <EmptyState
          title={t.common.empty}
          action={
            <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
              <Plus size={14} />
              {t.roles.add}
            </Button>
          }
        />
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {entries.map(([role, selector]) => (
            <div key={role} className="group flex h-[44px] items-center gap-3 px-1 py-2.5 hover:bg-[var(--color-hover)]">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="text-[13px] font-medium text-[var(--color-fg)]">{role}</span>
                {roles.data?.cycleOrder.includes(role) && <Badge tone="accent">cycle</Badge>}
              </div>
              <Select
                className="w-[280px]"
                value={selector}
                onChange={(e) => update(role, e.target.value)}
              >
                {!selectors.includes(selector) && <option value={selector}>{selector}</option>}
                {selectors.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <IconButton
                label={t.common.delete}
                className="opacity-0 group-hover:opacity-100"
                onClick={() => setDeleting(role)}
              >
                <Trash2 size={14} />
              </IconButton>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="text-[11px] uppercase tracking-wide text-[var(--color-fg-subtle)]">{t.roles.cycleOrder}</div>
        <Field hint={t.roles.cycleHint}>
          <Input mono value={cycle} onChange={(e) => setCycle(e.target.value)} />
        </Field>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={saveCycle}>
            <Check size={14} />
            {t.common.save}
          </Button>
          <div className="flex flex-wrap items-center gap-1.5">
            {(roles.data?.cycleOrder ?? []).map((r, i) => (
              <span key={r} className="flex items-center gap-1.5">
                <Badge tone="neutral">{r}</Badge>
                {i < (roles.data?.cycleOrder.length ?? 0) - 1 && (
                  <span className="text-[var(--color-fg-subtle)]">→</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      <Dialog
        open={creating}
        title={t.roles.add}
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button onClick={() => setCreating(false)}>{t.common.cancel}</Button>
            <Button variant="primary" disabled={!newRole.trim() || !newSelector.trim()} onClick={create}>
              {t.common.add}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label={t.common.role}>
            <Input value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="commit" />
          </Field>
          <Field label={t.common.selector} hint={t.roles.selectorHint}>
            <Input
              mono
              list="role-selectors"
              value={newSelector}
              onChange={(e) => setNewSelector(e.target.value)}
              placeholder="axon/model"
            />
          </Field>
          <datalist id="role-selectors">
            {selectors.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title={t.common.delete}
        message={t.roles.deleteConfirm.replace("{role}", deleting ?? "")}
        confirmLabel={t.common.delete}
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          const role = deleting!;
          setDeleting(null);
          try {
            await ipc.deleteModelRole(role);
            toast.success(t.common.delete, role);
            roles.reload();
          } catch (e) {
            toast.error(t.common.delete, errorText(e));
          }
        }}
      />
    </PageContainer>
  );
}
