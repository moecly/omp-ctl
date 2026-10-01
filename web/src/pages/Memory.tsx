import { useApp } from "../hooks/useApp";
import { useAsync } from "../hooks/useAsync";
import { ipc } from "../lib/ipc";
import { errorText } from "../lib/types";
import { toSettingInput } from "../lib/format";
import { toast } from "../lib/toast";
import { Badge, Button, Select } from "../components/ui";
import { PageError, PageSkeleton } from "../components/ui/PageState";
import { PageContainer } from "../components/shell/PageContainer";

const MEMORY_OPTIONS = ["off", "local", "hindsight", "mnemopi", "sharpshooter"];

export function Memory() {
  const { t } = useApp();
  const catalog = useAsync(() => ipc.listSettings(), []);
  const overview = useAsync(() => ipc.getOverview(), []);

  const backend = catalog.data?.entries.find((e) => e.key === "memory.backend");
  const options = backend?.options?.length ? backend.options : MEMORY_OPTIONS;

  const apply = async (value: string) => {
    try {
      await ipc.setSetting("memory.backend", value);
      toast.success(t.common.save, value);
      catalog.reload();
      overview.reload();
    } catch (e) {
      toast.error(t.common.save, errorText(e));
    }
  };

  const reset = async () => {
    try {
      await ipc.resetSetting("memory.backend");
      toast.success(t.common.reset, "memory.backend");
      catalog.reload();
      overview.reload();
    } catch (e) {
      toast.error(t.common.reset, errorText(e));
    }
  };

  const current = toSettingInput(backend?.value) || overview.data?.memoryBackend || "off";

  if (catalog.loading) {
    return (
      <PageContainer title={t.memory.title} description={t.pageDesc.memory}>
        <PageSkeleton rows={1} rowHeight={32} />
      </PageContainer>
    );
  }

  return (
    <PageContainer title={t.memory.title} description={t.pageDesc.memory}>
      {catalog.error && <PageError message={catalog.error} onRetry={() => catalog.reload()} />}
      {overview.error && <PageError message={overview.error} onRetry={() => overview.reload()} />}
      <div className="flex items-center gap-3">
        <Select className="max-w-[260px]" value={current} onChange={(e) => apply(e.target.value)}>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
        <Badge tone={backend?.configured ? "ok" : "neutral"}>
          {backend?.configured ? t.settings.configured : t.settings.unset}
        </Badge>
        {backend?.configured && (
          <Button size="sm" variant="ghost" onClick={reset}>
            {t.common.reset}
          </Button>
        )}
      </div>

      <p className="text-[12px] text-[var(--color-fg-subtle)]">{backend?.description || t.memory.hint}</p>
    </PageContainer>
  );
}
