import { invoke } from "@tauri-apps/api/core";
import { cachedInvoke, invalidate, prefetch } from "./queryCache";

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

const TTL = 30_000;
const get = <T>(key: string, fn: () => Promise<T>) => cachedInvoke(key, fn, TTL);

export const ipc = {
  getDirs: () => get("dirs", () => invoke<DirInfo>("get_dirs")),

  listProviders: () => get("providers", () => invoke<Provider[]>("list_providers")),
  listProviderSummaries: () =>
    get("provider-summaries", () => invoke<ProviderSummary[]>("list_provider_summaries")),
  getProvider: (id: string) =>
    get(`provider:${id}`, () => invoke<Provider | null>("get_provider", { id })),
  listModelRefs: () => get("model-refs", () => invoke<ModelRef[]>("list_model_refs")),
  upsertProvider: async (provider: Provider) => {
    const r = await invoke<SaveResult>("upsert_provider", { provider });
    invalidate("provider");
    invalidate("model-refs");
    invalidate("overview");
    return r;
  },
  deleteProvider: async (id: string) => {
    const r = await invoke<boolean>("delete_provider", { id });
    invalidate("provider");
    invalidate("model-refs");
    invalidate("overview");
    return r;
  },
  renameProvider: async (oldId: string, newId: string) => {
    const r = await invoke<SaveResult>("rename_provider", { oldId, newId });
    invalidate("provider");
    invalidate("model-refs");
    invalidate("overview");
    return r;
  },
  probeModels: (baseUrl: string, apiKey: string, authNone: boolean) =>
    invoke<string[]>("probe_models", { baseUrl, apiKey, authNone }),
  setDefaultModel: async (selector: string) => {
    await invoke<void>("set_default_model", { selector });
    invalidate("model-refs");
    invalidate("overview");
    invalidate("model-roles");
  },

  listPrompts: () => get("prompts", () => invoke<PromptState[]>("list_prompts")),
  setPromptEnabled: async (key: string, enabled: boolean) => {
    const r = await invoke<PromptState>("set_prompt_enabled", { key, enabled });
    invalidate("prompts");
    invalidate("overview");
    return r;
  },
  readPrompt: (key: string) =>
    get(`prompt:${key}`, () => invoke<string>("read_prompt", { key })),
  writePrompt: async (key: string, content: string) => {
    const r = await invoke<PromptState>("write_prompt", { key, content });
    invalidate("prompt");
    invalidate("prompts");
    invalidate("overview");
    return r;
  },
  restorePromptBackup: async (key: string) => {
    const r = await invoke<PromptState>("restore_prompt_backup", { key });
    invalidate("prompt");
    invalidate("prompts");
    return r;
  },

  openInFileManager: (path: string) => invoke<void>("open_in_file_manager", { path }),
  readConfig: () => get("config", () => invoke<Json>("read_config")),
  linkStates: () => get("links", () => invoke<Json[]>("link_states")),

  getOverview: () => get("overview", () => invoke<Overview>("get_overview")),

  listSettings: () => get("settings", () => invoke<SettingsCatalog>("list_settings")),
  setSetting: async (key: string, value: string) => {
    const r = await invoke<SettingEntry>("set_setting", { key, value });
    invalidate("settings");
    invalidate("overview");
    return r;
  },
  resetSetting: async (key: string) => {
    const r = await invoke<SettingEntry>("reset_setting", { key });
    invalidate("settings");
    invalidate("overview");
    return r;
  },

  listModelRoles: () => get("model-roles", () => invoke<ModelRoles>("list_model_roles")),
  setModelRole: async (role: string, selector: string) => {
    const r = await invoke<ModelRoles>("set_model_role", { role, selector });
    invalidate("model-roles");
    invalidate("overview");
    return r;
  },
  deleteModelRole: async (role: string) => {
    const r = await invoke<ModelRoles>("delete_model_role", { role });
    invalidate("model-roles");
    invalidate("overview");
    return r;
  },
  setCycleOrder: async (order: string[]) => {
    const r = await invoke<ModelRoles>("set_cycle_order", { order });
    invalidate("model-roles");
    invalidate("overview");
    return r;
  },

  listResources: (resource: ResourceId | string) =>
    get(`resources:${resource}`, () => invoke<ResourceEntry[]>("list_resources", { resource })),
  readResource: (resource: string, name: string) =>
    get(`resource:${resource}:${name}`, () =>
      invoke<string>("read_resource", { resource, name }),
    ),
  writeResource: async (resource: string, name: string, content: string) => {
    const r = await invoke<ResourceEntry>("write_resource", { resource, name, content });
    invalidate("resource");
    invalidate("overview");
    return r;
  },
  adoptResource: async (resource: string, name: string) => {
    const r = await invoke<ResourceEntry>("adopt_resource", { resource, name });
    invalidate("resource");
    invalidate("overview");
    return r;
  },
  deleteResource: async (resource: string, name: string) => {
    await invoke<void>("delete_resource", { resource, name });
    invalidate("resource");
    invalidate("overview");
  },
  setResourceEnabled: async (resource: string, name: string, enabled: boolean) => {
    const r = await invoke<ResourceEntry>("set_resource_enabled", { resource, name, enabled });
    invalidate("resource");
    return r;
  },
  restoreResource: async (resource: string, name: string) => {
    const r = await invoke<ResourceEntry>("restore_resource", { resource, name });
    invalidate("resource");
    return r;
  },

  listBuiltinTools: () =>
    get("builtin-tools", () => invoke<BuiltinTool[]>("list_builtin_tools")),
  readBuiltinToolDoc: (name: string) =>
    get(`builtin-tool:${name}`, () => invoke<string>("read_builtin_tool_doc", { name })),
  discoverSkills: () =>
    get("discovered-skills", () => invoke<DiscoveredSkill[]>("discover_skills")),
  listManagedSkills: () =>
    get("managed-skills", () => invoke<ResourceEntry[]>("list_managed_skills")),

  adoptConfigFile: async (name: string) => {
    const r = await invoke<LinkState>("adopt_config_file", { name });
    invalidate("links");
    invalidate("overview");
    return r;
  },
  listMcpServers: () => get("mcp", () => invoke<McpServer[]>("list_mcp_servers")),
  upsertMcpServer: async (name: string, value: Json) => {
    const r = await invoke<McpServer>("upsert_mcp_server", { name, value });
    invalidate("mcp");
    invalidate("overview");
    return r;
  },
  deleteMcpServer: async (name: string) => {
    await invoke<void>("delete_mcp_server", { name });
    invalidate("mcp");
    invalidate("overview");
  },
  setMcpServerEnabled: async (name: string, enabled: boolean) => {
    const r = await invoke<McpServer>("set_mcp_server_enabled", { name, enabled });
    invalidate("mcp");
    invalidate("overview");
    return r;
  },
};

export function prefetchRoute(page: string, param?: string) {
  switch (page) {
    case "overview":
      prefetch("overview", () => invoke("get_overview"), TTL);
      break;
    case "providers":
      prefetch("provider-summaries", () => invoke("list_provider_summaries"), TTL);
      break;
    case "models":
      prefetch("providers", () => invoke("list_providers"), TTL);
      prefetch("model-refs", () => invoke("list_model_refs"), TTL);
      break;
    case "roles":
      prefetch("model-roles", () => invoke("list_model_roles"), TTL);
      prefetch("model-refs", () => invoke("list_model_refs"), TTL);
      break;
    case "prompts":
      prefetch("prompts", () => invoke("list_prompts"), TTL);
      break;
    case "skills":
    case "agents":
    case "hooks":
      prefetch(`resources:${page === "hooks" ? "hooks_pre" : page}`, () =>
        invoke("list_resources", {
          resource: page === "hooks" ? "hooks_pre" : page,
        }),
      TTL);
      break;
    case "mcp":
      prefetch("mcp", () => invoke("list_mcp_servers"), TTL);
      break;
    case "tools":
      prefetch("builtin-tools", () => invoke("list_builtin_tools"), TTL);
      break;
    case "memory":
    case "settings":
      prefetch("settings", () => invoke("list_settings"), TTL);
      break;
  }
  if (param) prefetch(`provider:${param}`, () => invoke("get_provider", { id: param }), TTL);
}


