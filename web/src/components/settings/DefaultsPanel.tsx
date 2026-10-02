import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";

import { useApp } from "../../hooks/useApp";
import { useAsync } from "../../hooks/useAsync";
import { ipc } from "../../lib/ipc";
import { API_PRESETS, THINKING_LEVELS } from "../../lib/modelMeta";
import { errorText, type BackupSettings, type Defaults as DefaultsData, type ModelDefaults } from "../../lib/types";
import { toast } from "../../lib/toast";
import { Button, Field, Input, Select, Switch } from "../ui";
import { PageError, PageSkeleton } from "../ui/PageState";

const BLANK: DefaultsData = {
  model: { reasoning: false, imageInput: false },
  roleThinkingLevel: undefined,
  backup: { enabled: false, keep: 5 },
};

export function DefaultsPanel() {
  const { t } = useApp();
  const loaded = useAsync<DefaultsData>(() => ipc.getDefaults(), []);
  const [draft, setDraft] = useState<DefaultsData>(BLANK);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loaded.data) {
      const src = loaded.data;
      const sm = src.model ?? { reasoning: false, imageInput: false };
      setDraft({
        model: {
          api: sm.api,
          reasoning: sm.reasoning ?? false,
          imageInput: sm.imageInput ?? false,
          contextWindow: sm.contextWindow,
          maxTokens: sm.maxTokens,
          thinkingLevel: sm.thinkingLevel,
        },
        roleThinkingLevel: src.roleThinkingLevel,
        backup: { enabled: src.backup?.enabled ?? false, keep: src.backup?.keep ?? 5 },
      });
    }
  }, [loaded.data]);

  const patchModel = (next: Partial<ModelDefaults>) =>
    setDraft((d) => ({ ...d, model: { ...d.model, ...next } }));

  const patchBackup = (next: Partial<BackupSettings>) =>
    setDraft((d) => ({ ...d, backup: { ...(d.backup ?? { enabled: false, keep: 5 }), ...next } }));

  const md = draft.model;

  const save = async () => {
    setBusy(true);
    try {
      const r = await ipc.setDefaults(draft);
      setDraft(r);
      toast.success(t.defaults.save);
    } catch (e) {
      toast.error(t.defaults.save, errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[14px] font-medium text-[var(--color-fg)]">{t.defaults.title}</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={loaded.reload}>
            <RotateCcw size={14} />
            {t.common.refresh}
          </Button>
          <Button variant="primary" size="sm" disabled={busy} onClick={save}>
            {t.defaults.save}
          </Button>
        </div>
      </div>

      {loaded.loading ? (
        <PageSkeleton rows={3} />
      ) : loaded.error ? (
        <PageError message={loaded.error} onRetry={loaded.reload} />
      ) : (
        <div className="flex flex-col gap-4">
          <Field label={t.defaults.roleThinkingLevel} hint={t.defaults.roleThinkingLevelHint}>
            <Select
              className="max-w-[280px]"
              value={draft.roleThinkingLevel ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, roleThinkingLevel: e.target.value || undefined }))}
            >
              <option value="">{t.models.unset}</option>
              {THINKING_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex flex-col gap-4 border-t border-[var(--color-border)] pt-4">
            <h3 className="text-[13px] font-medium text-[var(--color-fg-muted)]">{t.defaults.modelDefaults}</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t.defaults.api}>
                <Select
                  value={md.api && !API_PRESETS.includes(md.api) ? "__custom" : (md.api ?? "")}
                  onChange={(e) =>
                    patchModel({ api: e.target.value === "__custom" ? md.api : e.target.value || undefined })
                  }
                >
                  <option value="">{t.models.unset}</option>
                  {API_PRESETS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                  {md.api && !API_PRESETS.includes(md.api) && <option value="__custom">{md.api}</option>}
                </Select>
              </Field>
              <Field label={t.defaults.thinkingLevel} hint={t.defaults.thinkingLevelHint}>
                <Select
                  value={md.thinkingLevel ?? ""}
                  onChange={(e) => patchModel({ thinkingLevel: e.target.value || undefined })}
                >
                  <option value="">{t.models.unset}</option>
                  {THINKING_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t.defaults.contextWindow}>
                <Input
                  type="number"
                  value={md.contextWindow ?? ""}
                  onChange={(e) =>
                    patchModel({ contextWindow: e.target.value === "" ? undefined : Number(e.target.value) })
                  }
                />
              </Field>
              <Field label={t.defaults.maxTokens}>
                <Input
                  type="number"
                  value={md.maxTokens ?? ""}
                  onChange={(e) =>
                    patchModel({ maxTokens: e.target.value === "" ? undefined : Number(e.target.value) })
                  }
                />
              </Field>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-[13px] text-[var(--color-fg-muted)]">
                <Switch checked={md.reasoning} onChange={(v) => patchModel({ reasoning: v })} label={t.defaults.reasoning} />
                {t.defaults.reasoning}
              </label>
              <label className="flex items-center gap-2 text-[13px] text-[var(--color-fg-muted)]">
                <Switch checked={md.imageInput} onChange={(v) => patchModel({ imageInput: v })} label={t.defaults.imageInput} />
                {t.defaults.imageInput}
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-[var(--color-border)] pt-4">
            <h3 className="text-[13px] font-medium text-[var(--color-fg-muted)]">{t.defaults.backupTitle}</h3>
            <Field label={t.defaults.backupEnabled} hint={t.defaults.backupEnabledHint}>
              <Switch checked={draft.backup.enabled} onChange={(v) => patchBackup({ enabled: v })} label={t.defaults.backupEnabled} />
            </Field>
            <Field label={t.defaults.backupKeep} hint={t.defaults.backupKeepHint}>
              <Input
                className="max-w-[160px]"
                type="number"
                min={1}
                max={100}
                value={draft.backup.keep}
                disabled={!draft.backup.enabled}
                onChange={(e) =>
                  patchBackup({ keep: e.target.value === "" ? 5 : Number.isNaN(Number(e.target.value)) ? 5 : Number(e.target.value) })
                }
              />
            </Field>
          </div>
        </div>
      )}
    </section>
  );
}
