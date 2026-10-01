import { invoke } from "@tauri-apps/api/core";

import type {
  BuiltinTool,
  DirInfo,
  DiscoveredSkill,
  Json,
  LinkState,
  McpServer,
  ModelRef,
  ModelRoles,
  Overview,
  PromptState,
  Provider,
  ProviderSummary,
  ResourceEntry,
  ResourceId,
  SaveResult,
  SettingEntry,
  SettingsCatalog,
} from "./types";

export const ipc = {
  getDirs: () => invoke<DirInfo>("get_dirs"),

  listProviders: () => invoke<Provider[]>("list_providers"),
  listProviderSummaries: () => invoke<ProviderSummary[]>("list_provider_summaries"),
  getProvider: (id: string) => invoke<Provider | null>("get_provider", { id }),
  listModelRefs: () => invoke<ModelRef[]>("list_model_refs"),
  upsertProvider: (provider: Provider) => invoke<SaveResult>("upsert_provider", { provider }),
  deleteProvider: (id: string) => invoke<boolean>("delete_provider", { id }),
  renameProvider: (oldId: string, newId: string) =>
    invoke<SaveResult>("rename_provider", { oldId, newId }),
  probeModels: (baseUrl: string, apiKey: string, authNone: boolean) =>
    invoke<string[]>("probe_models", { baseUrl, apiKey, authNone }),
  setDefaultModel: (selector: string) => invoke<void>("set_default_model", { selector }),

  listPrompts: () => invoke<PromptState[]>("list_prompts"),
  setPromptEnabled: (key: string, enabled: boolean) =>
    invoke<PromptState>("set_prompt_enabled", { key, enabled }),
  readPrompt: (key: string) => invoke<string>("read_prompt", { key }),
  writePrompt: (key: string, content: string) =>
    invoke<PromptState>("write_prompt", { key, content }),
  restorePromptBackup: (key: string) => invoke<PromptState>("restore_prompt_backup", { key }),

  openInFileManager: (path: string) => invoke<void>("open_in_file_manager", { path }),
  readConfig: () => invoke<Json>("read_config"),
  linkStates: () => invoke<Json[]>("link_states"),

  getOverview: () => invoke<Overview>("get_overview"),

  listSettings: () => invoke<SettingsCatalog>("list_settings"),
  setSetting: (key: string, value: string) => invoke<SettingEntry>("set_setting", { key, value }),
  resetSetting: (key: string) => invoke<SettingEntry>("reset_setting", { key }),

  listModelRoles: () => invoke<ModelRoles>("list_model_roles"),
  setModelRole: (role: string, selector: string) =>
    invoke<ModelRoles>("set_model_role", { role, selector }),
  deleteModelRole: (role: string) => invoke<ModelRoles>("delete_model_role", { role }),
  setCycleOrder: (order: string[]) => invoke<ModelRoles>("set_cycle_order", { order }),

  listResources: (resource: ResourceId | string) =>
    invoke<ResourceEntry[]>("list_resources", { resource }),
  readResource: (resource: string, name: string) =>
    invoke<string>("read_resource", { resource, name }),
  writeResource: (resource: string, name: string, content: string) =>
    invoke<ResourceEntry>("write_resource", { resource, name, content }),
  adoptResource: (resource: string, name: string) =>
    invoke<ResourceEntry>("adopt_resource", { resource, name }),
  deleteResource: (resource: string, name: string) =>
    invoke<void>("delete_resource", { resource, name }),
  setResourceEnabled: (resource: string, name: string, enabled: boolean) =>
    invoke<ResourceEntry>("set_resource_enabled", { resource, name, enabled }),
  restoreResource: (resource: string, name: string) =>
    invoke<ResourceEntry>("restore_resource", { resource, name }),

  listBuiltinTools: () => invoke<BuiltinTool[]>("list_builtin_tools"),
  readBuiltinToolDoc: (name: string) => invoke<string>("read_builtin_tool_doc", { name }),
  discoverSkills: () => invoke<DiscoveredSkill[]>("discover_skills"),
  listManagedSkills: () => invoke<ResourceEntry[]>("list_managed_skills"),

  adoptConfigFile: (name: string) => invoke<LinkState>("adopt_config_file", { name }),
  listMcpServers: () => invoke<McpServer[]>("list_mcp_servers"),
  upsertMcpServer: (name: string, value: Json) =>
    invoke<McpServer>("upsert_mcp_server", { name, value }),
  deleteMcpServer: (name: string) => invoke<void>("delete_mcp_server", { name }),
  setMcpServerEnabled: (name: string, enabled: boolean) =>
    invoke<McpServer>("set_mcp_server_enabled", { name, enabled }),
};
