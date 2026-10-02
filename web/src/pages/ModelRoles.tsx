import { useState } from "react";
import { Check, Plus, RotateCcw, Trash2 } from "lucide-react";

import { useApp } from "../hooks/useApp";
import { useAsync } from "../hooks/useAsync";
import { ipc } from "../lib/ipc";
import { errorText, type Defaults, type ModelRef, type ModelRoles as ModelRolesData } from "../lib/types";
import { joinSelector, splitSelector, THINKING_LEVELS } from "../lib/modelMeta";
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
import { PresetBar } from "../components/roles/PresetBar";

const KNOWN_ROLES: [string, string][] = [
  ["default", "Normal interactive work and the main-session default"],
  ["smol", "Fast, inexpensive utility work and fast handoff paths"],
  ["slow", "Thorough reasoning where extra latency is acceptable"],
  ["plan", "Plan-mode architecture and review"],
  ["vision", "Image inspection when a vision-capable model is needed"],
  ["designer", "The designer subagent"],
  ["commit", "Commit-message generation"],
  ["tiny", "Very small online classifications and titles"],
  ["task", "General subagent work"],
  ["advisor", "Independent reasoning model for Advisor"],
];

export function ModelRoles() {
  const { t } = useApp();
  const roles = useAsync<ModelRolesData>(() => ipc.listModelRoles(), []);
  const refs = useAsync<ModelRef[]>(() => ipc.listModelRefs(), []);
  const defaults = useAsync<Defaults>(() => ipc.getDefaults(), []);
  const defLevel = defaults.data?.roleThinkingLevel ?? "";

  const [newRole, setNewRole] = useState("");
  const [newSelector, setNewSelector] = useState("");
  const [newLevel, setNewLevel] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Selected preset is the live edit target: every change below writes back
  // to both config.yml and the preset itself.
  const [target, setTarget] = useState("");
  const [applying, setApplying] = useState(false);

  const select = async (name: string) => {
    setTarget(name);
    if (!name || applying) return;
    setApplying(true);
    try {
      await ipc.applyPreset(name);
      toast.success(t.presets.applied, name);
      roles.reload();
    } catch (e) {
      toast.error(t.presets.applied, errorText(e));
    } finally {
      setApplying(false);
    }
  };

  const syncPreset = async (next: ModelRolesData) => {
    if (!target) return;
    try {
      await ipc.savePreset(target, next.roles, next.cycleOrder);
    } catch (e) {
      toast.error(t.presets.saved, errorText(e));
    }
  };

  const mutate = async (fn: () => Promise<ModelRolesData>, note: string) => {
    try {
      const next = await fn();
      toast.success(t.common.save, note);
      roles.reload();
      await syncPreset(next);
    } catch (e) {
      toast.error(t.common.save, errorText(e));
    }
  };

  const create = async () => {
    if (!newRole.trim() || !newSelector.trim()) return;
    const role = newRole.trim();
    await mutate(
      () => ipc.setModelRole(role, joinSelector(newSelector.trim(), newLevel || defLevel)),
      role,
    );
    setNewRole("");
    setNewSelector("");
    setNewLevel("");
    setCreating(false);
  };

  const update = async (role: string, selector: string) => {
    await mutate(() => ipc.setModelRole(role, selector), role);
  };

  // Cycle order is edited by toggling roles; unknown entries stay pinned red
  // until removed so a typo or a deleted role can't silently vanish.
  const toggleCycle = async (role: string) => {
    const order = roles.data?.cycleOrder ?? [];
    const next = order.includes(role) ? order.filter((r) => r !== role) : [...order, role];
    await mutate(() => ipc.setCycleOrder(next), t.roles.cycleOrder);
  };

  const dropStale = async (role: string) => {
    const order = roles.data?.cycleOrder ?? [];
    await mutate(
      () => ipc.setCycleOrder(order.filter((r) => r !== role)),
      t.roles.cycleOrder,
    );
  };

  const confirmDelete = async () => {
    const role = deleting!;
    setDeleting(null);
    await mutate(() => ipc.deleteModelRole(role), role);
  };

  const selectors = (refs.data ?? []).map((r) => r.id);

  const entries = Object.entries(roles.data?.roles ?? {});
  const roleNames = new Set(entries.map(([role]) => role));
  const inCycle = new Set(roles.data?.cycleOrder ?? []);
  const stale = (roles.data?.cycleOrder ?? []).filter((r) => !roleNames.has(r));
  const missing = KNOWN_ROLES.filter(([role]) => !roleNames.has(role));

  const quickAdd = async (role: string) => {
    const selector = selectors[0] ?? Object.values(roles.data?.roles ?? {})[0] ?? "";
    if (!selector) return;
    const [m, l] = splitSelector(selector);
    await mutate(() => ipc.setModelRole(role, joinSelector(m, l || defLevel)), role);
  };

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
          <Button variant="primary" size="sm" onClick={() => {
              setNewLevel(defLevel);
              setCreating(true);
            }}>
            <Plus size={14} />
            {t.roles.add}
          </Button>
        </>
      }
    >
      {roles.error && <PageError message={roles.error} onRetry={roles.reload} />}
      {refs.error && <PageError message={refs.error} onRetry={refs.reload} />}

      <PresetBar target={target} onSelect={select} />

      {roles.loading ? (
        <PageSkeleton rows={4} />
      ) : entries.length === 0 ? (
        <EmptyState
          title={t.common.empty}
          action={
            <Button variant="primary" size="sm" onClick={() => {
              setNewLevel(defLevel);
              setCreating(true);
            }}>
              <Plus size={14} />
              {t.roles.add}
            </Button>
          }
        />
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {entries.map(([role, selector]) => {
            const [model, level] = splitSelector(selector);
            const ref = (refs.data ?? []).find((r) => r.id === model);
            const levels = ref?.thinking?.length ? ref.thinking : THINKING_LEVELS;
            return (
            <div key={role} className="group flex h-[44px] items-center gap-3 px-1 py-2.5 hover:bg-[var(--color-hover)]">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="text-[13px] font-medium text-[var(--color-fg)]">{role}</span>
                {role === "default" && <Badge tone="accent">{t.common.default}</Badge>}
                {inCycle.has(role) && <Badge tone="accent">cycle</Badge>}
              </div>
              <Select
                className="w-[240px]"
                value={selectors.includes(model) ? model : ""}
                disabled={applying}
                onChange={(e) => update(role, joinSelector(e.target.value, level))}
              >
                {!selectors.includes(model) && <option value="">{model}</option>}
                {selectors.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <Select
                className="w-[140px]"
                aria-label={t.roles.thinkingLevel}
                title={t.roles.thinkingLevel}
                value={level}
                disabled={applying}
                onChange={(e) => update(role, joinSelector(model, e.target.value))}
              >
                <option value="">{t.models.unset}</option>
                {!levels.includes(level) && level && <option value={level}>{level}</option>}
                {levels.map((l) => (
                  <option key={l} value={l}>
                    {l}
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
            );
          })}
        </div>
      )}
      {missing.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-[11px] uppercase tracking-wide text-[var(--color-fg-subtle)]">{t.roles.quickAdd}</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {missing.map(([role, desc]) => (
              <Button key={role} size="sm" title={desc} onClick={() => quickAdd(role)}>
                <Plus size={14} />
                {role}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="text-[11px] uppercase tracking-wide text-[var(--color-fg-subtle)]">{t.roles.cycleOrder}</div>
        <div className="text-[12px] text-[var(--color-fg-muted)]">{t.roles.cycleHint}</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {entries.map(([role]) => {
            const on = inCycle.has(role);
            return (
              <Button
                key={role}
                size="sm"
                variant={on ? "primary" : "ghost"}
                title={t.roles.cycleToggle.replace("{role}", role)}
                onClick={() => toggleCycle(role)}
              >
                {on && <Check size={14} />}
                {role}
              </Button>
            );
          })}
          {stale.map((role) => (
            <span key={role} title={t.roles.cycleStale.replace("{role}", role)}>
              <Button size="sm" variant="danger" onClick={() => dropStale(role)}>
                <Trash2 size={14} />
                {role}
              </Button>
            </span>
          ))}
        </div>
        {(roles.data?.cycleOrder.length ?? 0) > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {(roles.data?.cycleOrder ?? []).map((r, i) => (
              <span key={r} className="flex items-center gap-1.5">
                <Badge tone={roleNames.has(r) ? "neutral" : "danger"}>{r}</Badge>
                {i < (roles.data?.cycleOrder.length ?? 0) - 1 && (
                  <span className="text-[var(--color-fg-subtle)]">→</span>
                )}
              </span>
            ))}
          </div>
        )}
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
          <Field label={t.roles.thinkingLevel}>
            <Select value={newLevel} onChange={(e) => setNewLevel(e.target.value)}>
              <option value="">{t.models.unset}</option>
              {THINKING_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
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
        onConfirm={confirmDelete}
      />
    </PageContainer>
  );
}
