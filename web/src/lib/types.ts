export type LinkKind = "absent" | "managed" | "unmanaged";

export type DirSource =
  | "omp_cli"
  | "env_pi_coding_agent_dir"
  | "env_profile"
  | "xdg"
  | "default";

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export interface DirInfo {
  store: string;
  agent: string;
  agentSource: DirSource;
  agentSourceLabel: string;
  home: string;
}

export interface LinkState {
  path: string;
  kind: LinkKind;
  target: string | null;
}

export interface LinkStateRow {
  name: string;
  path: string;
  kind: LinkKind;
  target: string | null;
}

export interface ModelEntry {
  id: string;
  name?: string;
  api?: string;
  reasoning: boolean;
  imageInput: boolean;
  contextWindow?: number;
  maxTokens?: number;
  thinkingLevel?: string;
  raw: Json;
}

export interface CatalogModel {
  provider: string;
  id: string;
  name?: string;
  contextWindow?: number;
  maxTokens?: number;
  reasoning: boolean;
  thinking: string[];
  imageInput: boolean;
}

export interface Provider {
  id: string;
  baseUrl: string;
  api: string;
  apiKey: string;
  authNone: boolean;
  disableStrictTools: boolean;
  models: ModelEntry[];
  raw: Json;
}

export interface ProviderSummary {
  id: string;
  baseUrl: string;
  api: string;
  authNone: boolean;
  modelCount: number;
  hasApiKey: boolean;
}

export interface ModelRef {
  id: string;
  name?: string;
  thinking?: string[];
}

export interface SaveResult {
  backup: string | null;
}

export interface PromptState {
  key: string;
  name: string;
  label: string;
  risk: string;
  description: string;
  storePath: string;
  agentPath: string;
  enabled: boolean;
  link: LinkKind;
  linkTarget: string | null;
  hasBackup: boolean;
  storeExists: boolean;
  storeContent: string | null;
}

export interface SettingEntry {
  key: string;
  tab: string;
  value: Json;
  ty: string;
  description: string;
  options: string[] | null;
  configured: boolean;
}

export interface SettingsCatalog {
  tabs: string[];
  entries: SettingEntry[];
}

export interface ResourceEntry {
  resource: string;
  name: string;
  storePath: string;
  agentPath: string;
  enabled: boolean;
  link: LinkKind;
  linkTarget: string | null;
  foreign: boolean;
  hasBackup: boolean;
  storeExists: boolean;
  size: number | null;
  modified: number | null;
  summary: string | null;
  agentModel?: string | null;
  agentDisabled?: boolean;
  bundled?: boolean;
}

export interface BuiltinTool {
  name: string;
  title: string;
}

export interface DiscoveredSkill {
  name: string;
  description: string | null;
  filePath: string | null;
  baseDir: string | null;
  source: string | null;
  hide: boolean;
}

export interface ModelRoles {
  roles: Record<string, string>;
  cycleOrder: string[];
}

export interface ModelDefaults {
  api?: string;
  reasoning: boolean;
  imageInput: boolean;
  contextWindow?: number;
  maxTokens?: number;
  thinkingLevel?: string;
}

export interface BackupSettings {
  enabled: boolean;
  keep: number;
}

export interface Defaults {
  model: ModelDefaults;
  roleThinkingLevel?: string;
  backup: BackupSettings;
}

export interface Workspace {
  name: string;
  updatedAt: number;
  active: boolean;
}

export interface Preset {
  name: string;
  roles: Record<string, string>;
  cycleOrder: string[];
}

export interface BindingState {
  action: string;
  label: string | null;
  defaultChords: string[];
  chords: string[];
  overridden: boolean;
  disabled: boolean;
  known: boolean;
}

export interface KeybindingsState {
  file: string;
  agentPath: string;
  storePath: string;
  link: LinkKind;
  linkTarget: string | null;
  storeExists: boolean;
  hasBackup: boolean;
  bindings: BindingState[];
}

export interface McpServer {
  name: string;
  enabled: boolean;
  transport: string;
  command: string | null;
  args: string[];
  url: string | null;
  raw: Json;
}

export interface Overview {
  info: DirInfo;
  ompVersion: string | null;
  providers: ProviderSummary[];
  modelCount: number;
  modelRoles: Record<string, string>;
  cycleOrder: string[];
  prompts: PromptState[];
  resourceCounts: Record<string, number>;
  mcpServers: number;
  memoryBackend: string | null;
  approvalMode: string | null;
  enabledModels: Json[];
  disabledExtensions: Json[];
  links: LinkStateRow[];
}

export type AppError =
  | { kind: "fs"; path: string; message: string }
  | { kind: "yaml"; path: string; message: string }
  | { kind: "validation"; field: string; message: string }
  | { kind: "probe"; status: number | null; message: string }
  | { kind: "internal"; message: string };

export function errorText(e: unknown): string {
  if (typeof e === "string") return e;
  const err = e as Partial<AppError> & { message?: string };
  switch (err?.kind) {
    case "fs":
      return `文件错误 ${err.path}: ${err.message}`;
    case "yaml":
      return `YAML 错误 ${err.path}: ${err.message}`;
    case "validation":
      return `参数 ${err.field} 无效: ${err.message}`;
    case "probe":
      return err.status ? `探测失败 (HTTP ${err.status}): ${err.message}` : `探测失败: ${err.message}`;
    case "internal":
      return err.message ?? "未知错误";
    default:
      return err?.message ?? String(e);
  }
}

export type ResourceId =
  | "skills"
  | "agents"
  | "hooks_pre"
  | "hooks_post"
  | "extensions"
  | "tools";

export const RESOURCE_IDS: ResourceId[] = [
  "skills",
  "agents",
  "hooks_pre",
  "hooks_post",
  "extensions",
  "tools",
];
