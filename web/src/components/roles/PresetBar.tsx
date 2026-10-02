import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

import { useApp } from "../../hooks/useApp";
import { useAsync } from "../../hooks/useAsync";
import { ipc } from "../../lib/ipc";
import { errorText, type Preset } from "../../lib/types";
import { toast } from "../../lib/toast";
import { Button, ConfirmDialog, Dialog, Field, IconButton, Input, Select } from "../ui";

export function PresetBar({ onApplied }: { onApplied: () => void }) {
  const { t } = useApp();
  const presets = useAsync<Preset[]>(() => ipc.listPresets(), []);
  const [selected, setSelected] = useState("");
  const [dialog, setDialog] = useState<{ mode: "create" | "overwrite"; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const list = presets.data ?? [];
    if (!list.some((p) => p.name === selected)) setSelected(list[0]?.name ?? "");
  }, [presets.data, selected]);

  const submit = async () => {
    if (!dialog) return;
    const name = dialog.name.trim();
    if (!name) return;
    setBusy(true);
    try {
      const roles = await ipc.listModelRoles();
      await ipc.savePreset(name, roles.roles, roles.cycleOrder);
      presets.reload();
      setSelected(name);
      toast.success(t.presets.saved, name);
      setDialog(null);
    } catch (e) {
      toast.error(t.presets.saved, errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const change = async (name: string) => {
    setSelected(name);
    try {
      await ipc.applyPreset(name);
      toast.success(t.presets.applied, name);
      onApplied();
    } catch (e) {
      toast.error(t.presets.applied, errorText(e));
    }
  };

  const remove = async () => {
    const name = selected;
    setDeleting(false);
    try {
      await ipc.deletePreset(name);
      presets.reload();
      setSelected("");
      toast.success(t.presets.deleted, name);
    } catch (e) {
      toast.error(t.presets.deleted, errorText(e));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-y border-[var(--color-border)] py-3">
      <span className="shrink-0 text-[12px] text-[var(--color-fg-muted)]">{t.presets.title}</span>
      <Select
        className="w-[220px]"
        value={selected}
        onChange={(e) => change(e.target.value)}
        disabled={!presets.data?.length}
      >
        {!presets.data?.length && <option value="">{t.presets.empty}</option>}
        {(presets.data ?? []).map((p) => (
          <option key={p.name} value={p.name}>
            {p.name}
          </option>
        ))}
      </Select>
      <Button size="sm" disabled={!selected} onClick={() => setDialog({ mode: "overwrite", name: selected })}>
        {t.presets.overwrite}
      </Button>
      <Button size="sm" onClick={() => setDialog({ mode: "create", name: "" })}>
        {t.presets.captureCurrent}
      </Button>
      <IconButton label={t.common.delete} disabled={!selected} onClick={() => setDeleting(true)}>
        <Trash2 size={14} />
      </IconButton>

      <Dialog
        open={dialog !== null}
        title={dialog?.mode === "overwrite" ? t.presets.overwrite : t.presets.captureCurrent}
        onClose={() => setDialog(null)}
        footer={
          <>
            <Button onClick={() => setDialog(null)}>{t.common.cancel}</Button>
            <Button variant="primary" disabled={busy || !dialog?.name.trim()} onClick={submit}>
              {t.common.save}
            </Button>
          </>
        }
      >
        <Field label={t.presets.namePrompt}>
          <Input
            autoFocus
            value={dialog?.name ?? ""}
            onChange={(e) => setDialog((d) => (d ? { ...d, name: e.target.value } : d))}
          />
        </Field>
      </Dialog>

      <ConfirmDialog
        open={deleting}
        title={t.common.delete}
        message={t.presets.deleteConfirm.replace("{name}", selected)}
        confirmLabel={t.common.delete}
        danger
        onConfirm={remove}
        onCancel={() => setDeleting(false)}
      />
    </div>
  );
}
