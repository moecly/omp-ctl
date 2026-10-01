import { ChevronRight, Copy, RotateCcw } from "lucide-react";

import { useApp } from "../hooks/useApp";
import { useAsync } from "../hooks/useAsync";
import { ipc } from "../lib/ipc";
import { navigate } from "../lib/router";
import { toast } from "../lib/toast";
import type { LinkKind, Overview as OverviewData } from "../lib/types";
import { Badge, Button, Card, IconButton, KeyValue } from "../components/ui";
import { PageSkeleton, PageError } from "../components/ui/PageState";
import { EmptyState } from "../components/ui";
import { PageContainer } from "../components/shell/PageContainer";

const LINK_TONE: Record<LinkKind, "ok" | "warn" | "neutral"> = {
  managed: "ok",
  unmanaged: "warn",
  absent: "neutral",
};

export function Overview() {
  const { t } = useApp();
  const { data, loading, error, reload } = useAsync<OverviewData>(() => ipc.getOverview(), []);

  if (loading) {
    return (
      <PageContainer title={t.overview.title}>
        <PageSkeleton rows={5} />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer title={t.overview.title}>
        <PageError message={error} onRetry={reload} />
      </PageContainer>
    );
  }

  if (!data) {
    return (
      <PageContainer title={t.overview.title}>
        <EmptyState title={t.common.empty} />
      </PageContainer>
    );
  }

  const linkLabel: Record<LinkKind, string> = {
    managed: t.common.managed,
    unmanaged: t.common.unmanaged,
    absent: t.common.absent,
  };

  const quick: { label: string; to: string; count?: string }[] = [
    { label: t.nav.providers, to: "providers", count: String(data.providers.length) },
    { label: t.nav.models, to: "models", count: String(data.modelCount) },
    { label: t.nav.skills, to: "skills", count: String(data.resourceCounts.skills ?? 0) },
    { label: t.nav.mcp, to: "mcp", count: String(data.mcpServers) },
    { label: t.nav.settings, to: "settings" },
  ];
  const statCards = [
    { label: t.overview.providers, value: String(data.providers.length), to: "providers" },
    { label: t.overview.models, value: String(data.modelCount), to: "models" },
    { label: t.overview.skills, value: String(data.resourceCounts.skills ?? 0), to: "skills" },
    { label: t.overview.mcpServers, value: String(data.mcpServers), to: "mcp" },
    { label: t.overview.memory, value: data.memoryBackend ?? t.common.none, to: "memory" },
    { label: t.overview.approval, value: data.approvalMode ?? t.common.none, to: "settings" },
  ];

  return (
    <PageContainer
      title={t.overview.title}
      description={data.info.agent}
      actions={
        <Button variant="ghost" size="sm" onClick={reload}>
          <RotateCcw size={14} />
          {t.common.refresh}
        </Button>
      }
    >
      <div className="flex items-center gap-2 text-[12px] text-[var(--color-fg-subtle)]">
        <span className="truncate font-mono">{data.info.agent}</span>
        <IconButton
          label={t.common.copy}
          onClick={() => {
            navigator.clipboard.writeText(data.info.agent);
            toast.success(t.common.copied);
          }}
        >
          <Copy size={14} />
        </IconButton>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {statCards.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => navigate(s.to)}
            className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-left hover:bg-[var(--color-hover)]"
          >
            <span className="text-[13px] text-[var(--color-fg-muted)]">{s.label}</span>
            <span className="truncate text-[18px] font-semibold text-[var(--color-fg)]">{s.value}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title={t.overview.rolesTitle}>
          {Object.keys(data.modelRoles).length ? (
            <KeyValue
              rows={Object.entries(data.modelRoles).map(([role, selector]) => [
                role,
                <span className="font-mono">{selector}</span>,
              ])}
            />
          ) : (
            <span className="text-[12px] text-[var(--color-fg-subtle)]">{t.common.empty}</span>
          )}
        </Card>
        <Card title={t.overview.resourcesTitle}>
          <KeyValue rows={Object.entries(data.resourceCounts).map(([id, count]) => [id, String(count)])} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title={t.overview.quickLinks} flush>
          <div className="divide-y divide-[var(--color-border)]">
            {quick.map((row) => (
              <button
                key={row.to}
                type="button"
                onClick={() => navigate(row.to)}
                className="flex h-[44px] w-full items-center gap-3 px-4 text-left hover:bg-[var(--color-hover)]"
              >
                <span className="flex-1 text-[13px] text-[var(--color-fg)]">{row.label}</span>
                {row.count && <span className="text-[12px] text-[var(--color-fg-subtle)]">{row.count}</span>}
                <ChevronRight size={15} className="text-[var(--color-fg-subtle)]" />
              </button>
            ))}
          </div>
        </Card>

        <Card title={t.overview.links} flush>
          <div className="divide-y divide-[var(--color-border)]">
            {data.links.map((l) => (
              <div key={l.path} className="flex h-[44px] items-center gap-3 px-4 hover:bg-[var(--color-hover)]">
                <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--color-fg)]">{l.name}</span>
                <Badge tone={LINK_TONE[l.kind]}>{linkLabel[l.kind]}</Badge>
                <span className="max-w-[40%] truncate font-mono text-[12px] text-[var(--color-fg-subtle)]">
                  {l.target ?? "—"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card
        title={t.overview.promptsTitle}
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate("prompts")}>
            {t.nav.prompts} →
          </Button>
        }
        flush
      >
        <div className="divide-y divide-[var(--color-border)]">
          {data.prompts.map((p) => (
            <div key={p.key} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[13px] text-[var(--color-fg)]">
                  {p.label}
                  <Badge tone="neutral">{p.name}</Badge>
                </div>
                <div className="truncate text-[12px] text-[var(--color-fg-subtle)]">{p.description}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={p.enabled ? "ok" : "neutral"}>
                  {p.enabled ? t.common.enabled : t.common.disabled}
                </Badge>
                <Badge tone={LINK_TONE[p.link]}>{linkLabel[p.link]}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </PageContainer>
  );
}
