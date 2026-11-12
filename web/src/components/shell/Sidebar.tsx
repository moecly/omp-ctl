import {
  Bot,
  Boxes,
  Brain,
  FileText,
  Hexagon,
  Keyboard,
  Layers,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Puzzle,
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

const GROUP_WORKSPACES: NavItem[] = [{ page: "workspaces", key: "workspaces", icon: Layers }];

const GROUP_RESOURCES: NavItem[] = [
  { page: "skills", key: "skills", icon: Sparkles },
  { page: "agents", key: "agents", icon: Bot },
  { page: "mcp", key: "mcp", icon: Plug },
  { page: "hooks", key: "hooks", icon: Webhook },
  { page: "extensions", key: "extensions", icon: Puzzle },
  { page: "tools", key: "tools", icon: Wrench },
];

const GROUP_SYSTEM: NavItem[] = [
  { page: "memory", key: "memory", icon: Brain },
  { page: "keybindings", key: "keybindings", icon: Keyboard },
  { page: "settings", key: "settings", icon: Settings },
  { page: "backup", key: "backup", icon: Save },
];

export const NAV: NavItem[] = [...GROUP_CONFIG, ...GROUP_WORKSPACES, ...GROUP_RESOURCES, ...GROUP_SYSTEM];

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
    { title: t.nav.workspaces, items: GROUP_WORKSPACES },
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
          "flex h-10 items-center gap-3 rounded-full px-3.5 text-[13px] font-medium",
          "transition-[background-color,color,padding] duration-[var(--dur-medium)] ease-[var(--ease-emphasized)]",
          collapsed && "justify-center px-0",
          isActive
            ? "bg-[var(--m3-secondary-container)] text-[var(--m3-on-secondary-container)]"
            : "text-[var(--color-fg-muted)] hover:bg-[color-mix(in_srgb,var(--color-fg)_8%,transparent)] hover:text-[var(--color-fg)]",
        )}
      >
        <Icon
          size={18}
          strokeWidth={2.1}
          className={cn("shrink-0", isActive && "text-[var(--m3-on-secondary-container)]")}
        />
        {!collapsed && <span className="truncate">{t.nav[item.key]}</span>}
      </button>
    );
  };

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col overflow-hidden bg-[var(--color-bg)]",
        "transition-[width] duration-[var(--dur-medium)] ease-[var(--ease-emphasized)]",
        collapsed ? "w-[76px]" : "w-[248px]",
      )}
    >
      <div className="flex h-[56px] shrink-0 items-center gap-2.5 px-4">
        <Hexagon size={22} strokeWidth={2.4} className="shrink-0 text-[var(--color-accent)]" />
        {!collapsed && (
          <span className="truncate text-[14px] font-medium tracking-[-0.01em] text-[var(--color-fg)]">{t.appName}</span>
        )}
        <IconButton label={t.shell.toggleSidebar} onClick={onToggle} className="ml-auto">
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </IconButton>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <div key={group.title} className="flex flex-col gap-0.5">
            {!collapsed && (
              <div className="px-3.5 pb-1 pt-3 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-fg-subtle)]">
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
