import {
  Bot,
  Boxes,
  Brain,
  FileText,
  Hexagon,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Save,
  Server,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Webhook,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { useApp } from "../../hooks/useApp";
import type { Route } from "../../lib/router";
import type { Strings } from "../../lib/i18n";
import { cn } from "../../lib/cn";
import { prefetchRoute } from "../../lib/ipc";
import { IconButton } from "../ui";

interface NavItem {
  page: string;
  key: keyof Strings["nav"];
  icon: LucideIcon;
}

const GROUP_CONFIG: NavItem[] = [
  { page: "overview", key: "overview", icon: LayoutDashboard },
  { page: "providers", key: "providers", icon: Server },
  { page: "models", key: "models", icon: Boxes },
  { page: "roles", key: "roles", icon: SlidersHorizontal },
  { page: "prompts", key: "prompts", icon: FileText },
];

const GROUP_RESOURCES: NavItem[] = [
  { page: "skills", key: "skills", icon: Sparkles },
  { page: "agents", key: "agents", icon: Bot },
  { page: "mcp", key: "mcp", icon: Plug },
  { page: "hooks", key: "hooks", icon: Webhook },
  { page: "tools", key: "tools", icon: Wrench },
];

const GROUP_SYSTEM: NavItem[] = [
  { page: "memory", key: "memory", icon: Brain },
  { page: "settings", key: "settings", icon: Settings },
  { page: "backup", key: "backup", icon: Save },
];

export const NAV: NavItem[] = [...GROUP_CONFIG, ...GROUP_RESOURCES, ...GROUP_SYSTEM];

export function Sidebar({
  route,
  collapsed,
  onToggle,
  onNavigate,
}: {
  route: Route;
  collapsed: boolean;
  onToggle: () => void;
  onNavigate: (page: string) => void;
}) {
  const { t } = useApp();

  const groups: { title: string; items: NavItem[] }[] = [
    { title: t.groups.config, items: GROUP_CONFIG },
    { title: t.groups.resources, items: GROUP_RESOURCES },
    { title: t.groups.system, items: GROUP_SYSTEM },
  ];

  const renderItem = (item: NavItem) => {
    const isActive = route.page === item.page;
    const Icon = item.icon;
    return (
      <button
        key={item.page}
        type="button"
        title={t.nav[item.key]}
        onClick={() => onNavigate(item.page)}
        onMouseEnter={() => prefetchRoute(item.page)}
        className={cn(
          "flex h-[30px] items-center gap-2.5 rounded-[var(--radius-md)] px-2 text-[13px]",
          collapsed && "justify-center px-0",
          isActive
            ? "bg-[var(--color-active)] text-[var(--color-fg)]"
            : "text-[var(--color-fg-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-fg)]",
        )}
      >
        <Icon size={15} strokeWidth={1.75} className={cn("shrink-0", isActive && "text-[var(--color-accent)]")} />
        {!collapsed && <span className="truncate">{t.nav[item.key]}</span>}
      </button>
    );
  };

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg)]",
        collapsed ? "w-[56px]" : "w-[232px]",
      )}
    >
      <div className="flex h-[52px] shrink-0 items-center gap-2 px-3">
        <Hexagon size={18} className="shrink-0 text-[var(--color-accent)]" />
        {!collapsed && <span className="truncate text-[13px] font-medium text-[var(--color-fg)]">{t.appName}</span>}
        <IconButton label={t.shell.toggleSidebar} onClick={onToggle} className="ml-auto">
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </IconButton>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3">
        {groups.map((group) => (
          <div key={group.title} className="flex flex-col gap-0.5">
            {!collapsed && (
              <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-[var(--color-fg-subtle)]">
                {group.title}
              </div>
            )}
            {group.items.map(renderItem)}
          </div>
        ))}
      </nav>
    </aside>
  );
}
