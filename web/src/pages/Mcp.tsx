import { useEffect, useState } from "react";
import { Check, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";

import { useApp } from "../hooks/useApp";
import { useAsync } from "../hooks/useAsync";
import { ipc } from "../lib/ipc";
import { errorText, type Json, type McpServer, type Overview } from "../lib/types";
import { displayValue } from "../lib/format";
import { toast } from "../lib/toast";
import {
  Badge,
  Banner,
  Button,
  Checkbox,
  CodeEditor,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  Select,
  Switch,
} from "../components/ui";
import { PageError, PageSkeleton } from "../components/ui/PageState";
import { PageContainer } from "../components/shell/PageContainer";

export function Mcp() {
  const { t } = useApp();
  const servers = useAsync<McpServer[]>(() => ipc.listMcpServers(), []);
  const overview = useAsync<Overview>(() => ipc.getOverview(), []);
  const [editing, setEditing] = useState<{ server: McpServer | null } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<McpServer | null>(null);
  const [adopting, setAdopting] = useState(false);

  const mcpLink = overview.data?.links.find((l) => l.name === "mcp.json");
  const unmanaged = mcpLink?.kind === "unmanaged";

  const mutate = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast.success(msg);
      servers.reload();
      overview.reload();
    } catch (e) {
      toast.error(msg, errorText(e));
    }
  };

  const list = servers.data ?? [];

  return (
    <PageContainer
      title={t.mcp.title}
      description={t.pageDesc.mcp}
      actions={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              servers.reload();
              overview.reload();
            }}
          >
            <RotateCcw size={14} />
            {t.common.refresh}
          </Button>
          <Button variant="primary" size="sm" onClick={() => setEditing({ server: null })}>
            <Plus size={14} />
            {t.mcp.add}
          </Button>
        </>
      }
    >
      {unmanaged && (
        <Banner tone="warn" action={<Button size="sm" onClick={() => setAdopting(true)}>{t.common.adopt}</Button>}>
          {t.mcp.adoptHint}
        </Banner>
      )}
      {overview.error && <PageError message={overview.error} onRetry={overview.reload} />}
      {servers.loading ? (
        <PageSkeleton rows={4} />
      ) : servers.error ? (
        <PageError message={servers.error} onRetry={servers.reload} />
      ) : list.length === 0 ? (
        <EmptyState
          title={t.common.empty}
          action={
            <Button variant="primary" size="sm" onClick={() => setEditing({ server: null })}>
              <Plus size={14} />
              {t.mcp.add}
            </Button>
          }
        />
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {list.map((s) => (
            <div key={s.name}>
              <div
                className="group flex h-[44px] cursor-pointer items-center gap-3 px-1 py-2.5 hover:bg-[var(--color-hover)]"
                onClick={() => setExpanded((cur) => (cur === s.name ? null : s.name))}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--color-fg)]">
                    {s.name}
                    <Badge tone="neutral">{s.transport}</Badge>
                  </div>
                  <div className="truncate font-mono text-[12px] text-[var(--color-fg-subtle)]">
                    {s.command ? `${s.command} ${s.args.join(" ")}` : (s.url ?? "—")}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={s.enabled}
                    onChange={(v) => mutate(() => ipc.setMcpServerEnabled(s.name, v), t.common.save)}
                  />
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                    <IconButton label={t.common.edit} onClick={() => setExpanded((cur) => (cur === s.name ? null : s.name))}>
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton label={t.common.delete} onClick={() => setDeleting(s)}>
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </div>
              </div>
              {expanded === s.name && (
                <div className="mb-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
                  <McpForm
                    server={s}
                    onClose={() => setExpanded(null)}
                    onSaved={() => {
                      setExpanded(null);
                      servers.reload();
                      overview.reload();
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && !editing.server && (
        <Dialog open wide title={t.mcp.add} onClose={() => setEditing(null)}>
          <McpForm
            server={null}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              servers.reload();
              overview.reload();
            }}
          />
        </Dialog>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={t.common.delete}
        message={t.mcp.deleteConfirm.replace("{name}", deleting?.name ?? "")}
        confirmLabel={t.common.delete}
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const s = deleting!;
          setDeleting(null);
          void mutate(() => ipc.deleteMcpServer(s.name), t.common.delete);
        }}
      />

      <ConfirmDialog
        open={adopting}
        title={t.common.adopt}
        message={t.resources.attachConfirm.replace("{name}", "mcp.json")}
        confirmLabel={t.common.adopt}
        onCancel={() => setAdopting(false)}
        onConfirm={() => {
          setAdopting(false);
          void mutate(() => ipc.adoptConfigFile("mcp.json"), t.common.adopt);
        }}
      />
    </PageContainer>
  );
}

function McpForm({
  server,
  onClose,
  onSaved,
}: {
  server: McpServer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useApp();
  const [name, setName] = useState(server?.name ?? "");
  const [transport, setTransport] = useState(server?.transport ?? "stdio");
  const [command, setCommand] = useState(server?.command ?? "");
  const [args, setArgs] = useState((server?.args ?? []).join(" "));
  const [url, setUrl] = useState(server?.url ?? "");
  const [raw, setRaw] = useState(server ? JSON.stringify(server.raw, null, 2) : "");
  const [useRaw, setUseRaw] = useState(false);
  const [rawError, setRawError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!useRaw) return;
    try {
      JSON.parse(raw);
      setRawError(null);
    } catch {
      setRawError(t.mcp.invalidJson);
    }
  }, [raw, useRaw, t]);

  const save = async () => {
    setBusy(true);
    try {
      const value: Json = useRaw
        ? JSON.parse(raw)
        : transport === "stdio"
          ? { type: transport, command, args: args.split(/\s+/).filter(Boolean) }
          : { type: transport, url };
      await ipc.upsertMcpServer(name.trim(), value);
      toast.success(t.common.save, name.trim());
      onSaved();
    } catch (e) {
      toast.error(t.common.save, e instanceof SyntaxError ? t.mcp.invalidJson : errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label={t.common.name} hint={t.mcp.nameHint}>
          <Input mono value={name} onChange={(e) => setName(e.target.value)} disabled={!!server} />
        </Field>
        <Field label={t.mcp.transport}>
          <Select value={transport} onChange={(e) => setTransport(e.target.value)} disabled={useRaw}>
            <option value="stdio">stdio</option>
            <option value="http">http</option>
            <option value="sse">sse</option>
          </Select>
        </Field>
      </div>

      {transport === "stdio" ? (
        <div className="grid grid-cols-2 gap-4">
          <Field label={t.mcp.command}>
            <Input mono value={command} onChange={(e) => setCommand(e.target.value)} disabled={useRaw} />
          </Field>
          <Field label={t.mcp.args}>
            <Input mono value={args} onChange={(e) => setArgs(e.target.value)} disabled={useRaw} />
          </Field>
        </div>
      ) : (
        <Field label={t.mcp.url}>
          <Input mono value={url} onChange={(e) => setUrl(e.target.value)} disabled={useRaw} />
        </Field>
      )}

      <div className="flex flex-col gap-2">
        <Checkbox checked={useRaw} onChange={setUseRaw}>
          {t.mcp.rawJson}
        </Checkbox>
        {useRaw && (
          <>
            {rawError && <span className="text-[11px] text-[var(--color-danger)]">{rawError}</span>}
            {!rawError && server && (
              <span className="text-[11px] text-[var(--color-fg-subtle)]">{displayValue(server.transport)}</span>
            )}
            <CodeEditor value={raw} onChange={setRaw} rows={10} />
          </>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button onClick={onClose}>{t.common.cancel}</Button>
        <Button variant="primary" disabled={busy || !name.trim() || (useRaw && !!rawError)} onClick={save}>
          <Check size={14} />
          {t.common.save}
        </Button>
      </div>
    </div>
  );
}
