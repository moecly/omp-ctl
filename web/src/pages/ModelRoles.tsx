import { useState } from "react";
import { Check, Plus, RotateCcw, Trash2 } from "lucide-react";

import { useApp } from "../hooks/useApp";
import { useAsync } from "../hooks/useAsync";
import { ipc } from "../lib/ipc";
import { errorText, type Defaults, type ModelRef, type ModelRoles as ModelRolesData, type Preset } from "../lib/types";
import { joinSelector, splitSelector, THINKING_LEVELS } from "../lib/modelMeta";
import { loadPreset, savePreset } from "../lib/prefs";
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
  const presets = useAsync<Preset[]>(() => ipc.listPresets(), []);
  // Selected preset is the live edit target: every change below writes back
  // to both config.yml and the preset itself.
  const [target, setTarget] = useState(loadPreset);
  const [applying, setApplying] = useState(false);

  const select = async (name: string) => {
    setTarget(name);
    savePreset(name);
    if (!name || applying) return;
    setApplying(true);
    try {
      const { workspaceSynced } = await ipc.applyPreset(name);
      toast.success(t.presets.applied, name);
      if (workspaceSynced) toast.info(t.presets.workspaceSynced, workspaceSynced);
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
    const selector = newSelector.trim();
    const wanted = newLevel || defLevel;
    const level = levelsFor(selector).includes(wanted) ? wanted : "";
    await mutate(() => ipc.setModelRole(role, joinSelector(selector, level)), role);
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
  const levelsFor = (selector: string) => {
    const head = splitSelector(selector)[0];
    const ref = (refs.data ?? []).find((r) => r.id === head);
    return ref?.thinking?.length ? ref.thinking : THINKING_LEVELS;
  };
  const validTarget = !presets.data || presets.data.some((p) => p.name === target) ? target : "";

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

      <PresetBar target={validTarget} presets={presets} onSelect={select} />

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
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="min-w-[620px]">
            <div className="grid grid-cols-[148px_minmax(0,1fr)_124px_36px] items-center gap-3 border-b border-[var(--color-border)] px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-fg-subtle)]">
              <span>{t.roles.name}</span>
              <span>{t.roles.model}</span>
              <span>{t.roles.thinkingLevel}</span>
              <span />
            </div>
            <div className="flex flex-col gap-0.5">
              {entries.map(([role, selector]) => {
                const [model, level] = splitSelector(selector);
                const levels = levelsFor(selector);
                const slash = model.indexOf("/");
                const provider = slash > 0 ? model.slice(0, slash) : "";
                const bare = slash > 0 ? model.slice(slash + 1) : model;
                return (
                  <div
                    key={role}
                    className={cn(
                      "group grid grid-cols-[148px_minmax(0,1fr)_124px_36px] items-center gap-3",
                      // A padded pill, not a full-bleed band: a band's left and
                      // right radii are clipped by the scroll container, which is
                      // why both ends looked cut off.
                      "rounded-[var(--radius-md)] px-3 py-2 transition-colors duration-[var(--dur-short)]",
                      "hover:bg-[var(--color-hover)] focus-within:bg-[var(--color-hover)]",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="truncate text-[13px] font-medium tracking-[-0.005em] text-[var(--color-fg)]"
                        title={role}
                      >
                        {role}
                      </span>
                      {role === "default" && <Badge tone="accent">{t.common.default}</Badge>}
                      {inCycle.has(role) && (
                        <span
                          title="cycle"
                          className="shrink-0 rounded-full bg-[var(--color-surface-2)] px-1.5 text-[10px] font-medium leading-4 text-[var(--color-fg-subtle)]"
                        >
                          ↻
                        </span>
                      )}
                    </div>
                    <Select
                      className="min-w-0"
                      value={selectors.includes(model) ? model : ""}
                      disabled={applying}
                      onChange={(e) => {
                        const next = e.target.value;
                        update(role, joinSelector(next, levelsFor(next).includes(level) ? level : ""));
                      }}
                    >
                      {!selectors.includes(model) && (
                        <option value="">
                          {provider ? `${provider} / ${bare}` : model}
                        </option>
                      )}
                      {selectors.map((s) => {
                        const i = s.indexOf("/");
                        return (
                          <option key={s} value={s}>
                            {i > 0 ? `${s.slice(0, i)} / ${s.slice(i + 1)}` : s}
                          </option>
                        );
                      })}
                    </Select>
                    <Select
                      className="w-[124px] shrink-0"
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
                      className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={() => setDeleting(role)}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                );
              })}
            </div>
          </div>
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
              onChange={(e) => {
                const next = e.target.value;
                setNewSelector(next);
                if (newLevel && !levelsFor(next).includes(newLevel)) setNewLevel("");
              }}
              placeholder="axon/model"
            />
          </Field>
          <Field label={t.roles.thinkingLevel}>
            <Select value={newLevel} onChange={(e) => setNewLevel(e.target.value)}>
              <option value="">{t.models.unset}</option>
              {levelsFor(newSelector).map((l) => (
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
