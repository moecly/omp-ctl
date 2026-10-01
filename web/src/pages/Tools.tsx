import { useState } from "react";
import { FolderOpen } from "lucide-react";

import { useApp } from "../hooks/useApp";
import { useAsync } from "../hooks/useAsync";
import { ipc } from "../lib/ipc";
import { errorText, type BuiltinTool, type DiscoveredSkill, type ResourceEntry } from "../lib/types";
import { toast } from "../lib/toast";
import { Badge, Button, Dialog, EmptyState, SearchInput, Tabs } from "../components/ui";
import { PageError, PageSkeleton } from "../components/ui/PageState";
import { PageContainer } from "../components/shell/PageContainer";

export function Tools() {
  const { t } = useApp();
  const [tab, setTab] = useState("builtin");

  return (
    <PageContainer title={t.tools.title} description={t.pageDesc.tools}>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "builtin", label: t.tools.builtin },
          { id: "managed", label: t.tools.managed },
          { id: "discovered", label: t.tools.discovered },
        ]}
      />

      {tab === "builtin" && <BuiltinTools />}
      {tab === "managed" && <ManagedTools />}
      {tab === "discovered" && <Discovered />}
    </PageContainer>
  );
}

function SkeletonRows({ n }: { n: number }) {
  return <PageSkeleton rows={n} />;
}

function BuiltinTools() {
  const { t } = useApp();
  const tools = useAsync<BuiltinTool[]>(() => ipc.listBuiltinTools(), []);
  const [doc, setDoc] = useState<{ name: string; body: string } | null>(null);
  const [query, setQuery] = useState("");

  if (tools.loading) return <SkeletonRows n={5} />;
  if (tools.error) return <PageError message={tools.error} onRetry={tools.reload} />;

  const list = (tools.data ?? []).filter((x) => x.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <div className="max-w-[280px]">
        <SearchInput value={query} onChange={setQuery} placeholder={t.common.search} />
      </div>

      {list.length === 0 ? (
        <EmptyState title={t.common.empty} />
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {list.map((tool) => (
            <button
              key={tool.name}
              type="button"
              onClick={async () => {
                try {
                  setDoc({ name: tool.name, body: await ipc.readBuiltinToolDoc(tool.name) });
                } catch (e) {
                  toast.error(t.tools.docTitle, errorText(e));
                }
              }}
              className="flex h-[44px] w-full items-center gap-3 px-1 text-left hover:bg-[var(--color-hover)]"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-[var(--color-fg)]">{tool.title}</div>
                <div className="truncate font-mono text-[11px] text-[var(--color-fg-subtle)]">{tool.name}</div>
              </div>
              <Badge tone="neutral">{t.common.builtin}</Badge>
            </button>
          ))}
        </div>
      )}

      <Dialog open={doc !== null} wide title={doc?.name ?? ""} onClose={() => setDoc(null)}>
        <pre className="m-0 whitespace-pre-wrap font-mono text-[12px] text-[var(--color-fg-muted)]">{doc?.body}</pre>
      </Dialog>
    </>
  );
}

function ManagedTools() {
  const { t } = useApp();
  const skills = useAsync<ResourceEntry[]>(() => ipc.listManagedSkills(), []);

  if (skills.loading) return <SkeletonRows n={5} />;
  if (skills.error) return <PageError message={skills.error} onRetry={skills.reload} />;

  return (
    <div className="divide-y divide-[var(--color-border)]">
      {(skills.data ?? []).map((s) => (
        <div key={s.name} className="flex h-[44px] items-center gap-3 px-1 py-2.5 hover:bg-[var(--color-hover)]">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-[var(--color-fg)]">{s.name}</div>
            <div className="truncate font-mono text-[11px] text-[var(--color-fg-subtle)]">{s.storePath}</div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => ipc.openInFileManager(s.storePath)}>
            <FolderOpen size={14} />
            {t.common.openFolder}
          </Button>
        </div>
      ))}
    </div>
  );
}

function Discovered() {
  const { t } = useApp();
  const skills = useAsync<DiscoveredSkill[]>(() => ipc.discoverSkills(), []);

  if (skills.loading) return <SkeletonRows n={5} />;
  if (skills.error) return <PageError message={skills.error} onRetry={skills.reload} />;

  return (
    <div className="divide-y divide-[var(--color-border)]">
      {(skills.data ?? []).map((s) => (
        <div key={s.name} className="flex items-center gap-3 px-1 py-2.5 hover:bg-[var(--color-hover)]">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[13px] text-[var(--color-fg)]">
              {s.name}
              {s.hide && <Badge tone="warn">{t.tools.hide}</Badge>}
            </div>
            <div className="truncate text-[12px] text-[var(--color-fg-subtle)]">{s.description ?? "—"}</div>
          </div>
          {s.source && <Badge tone="neutral">{s.source}</Badge>}
        </div>
      ))}
    </div>
  );
}
