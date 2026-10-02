import { useState } from "react";
import { Trash2 } from "lucide-react";

import { useApp } from "../../hooks/useApp";
import { useAsync } from "../../hooks/useAsync";
import { ipc } from "../../lib/ipc";
import { errorText, type Preset } from "../../lib/types";
import { toast } from "../../lib/toast";
import { Button, ConfirmDialog, Dialog, Field, IconButton, Input, Select } from "../ui";

export function PresetBar({
  target,
  onSelect,
}: {
  target: string;
  onSelect: (name: string) => void;
}) {
  const { t } = useApp();
  const presets = useAsync<Preset[]>(() => ipc.listPresets(), []);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const list = presets.data ?? [];

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || list.some((p) => p.name === trimmed)) return;
    setBusy(true);
    try {
      const roles = await ipc.listModelRoles();
      await ipc.savePreset(trimmed, roles.roles, roles.cycleOrder);
      presets.reload();
      onSelect(trimmed);
      toast.success(t.presets.saved, trimmed);
      setName("");
      setCreating(false);
    } catch (e) {
      toast.error(t.presets.saved, errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const gone = target;
    setDeleting(false);
    setBusy(true);
    try {
      await ipc.deletePreset(gone);
      presets.reload();
      onSelect("");
      toast.success(t.presets.deleted, gone);
    } catch (e) {
      toast.error(t.presets.deleted, errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-y border-[var(--color-border)] py-3">
      <span className="shrink-0 text-[12px] text-[var(--color-fg-muted)]">{t.presets.title}</span>
      <Select
        className="w-[220px]"
        value={target}
        onChange={(e) => onSelect(e.target.value)}
        disabled={list.length === 0 || busy}
      >
        <option value="">{list.length ? t.presets.select : t.presets.empty}</option>
        {list.map((p) => (
          <option key={p.name} value={p.name}>
            {p.name}
          </option>
        ))}
      </Select>
      <Button size="sm" disabled={busy} onClick={() => setCreating(true)}>
        {t.presets.captureCurrent}
      </Button>
      <IconButton label={t.common.delete} disabled={!target || busy} onClick={() => setDeleting(true)}>
        <Trash2 size={14} />
      </IconButton>

      <Dialog
        open={creating}
        title={t.presets.captureCurrent}
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button onClick={() => setCreating(false)}>{t.common.cancel}</Button>
            <Button
              variant="primary"
              disabled={busy || !name.trim() || list.some((p) => p.name === name.trim())}
              onClick={submit}
            >
              {t.common.save}
            </Button>
          </>
        }
      >
        <Field label={t.presets.namePrompt}>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </Dialog>

      <ConfirmDialog
        open={deleting}
        title={t.common.delete}
        message={t.presets.deleteConfirm.replace("{name}", target)}
        confirmLabel={t.common.delete}
        danger
        onConfirm={remove}
        onCancel={() => setDeleting(false)}
      />
    </div>
  );
}
