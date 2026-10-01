export const LOCALES = ["zh", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export interface Strings {
  appName: string;
  groups: { config: string; resources: string; system: string };
  nav: {
    overview: string;
    providers: string;
    models: string;
    roles: string;
    prompts: string;
    skills: string;
    agents: string;
    mcp: string;
    hooks: string;
    tools: string;
    memory: string;
    settings: string;
    extensions: string;
  };
  common: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    create: string;
    close: string;
    confirm: string;
    refresh: string;
    loading: string;
    empty: string;
    search: string;
    adopt: string;
    restore: string;
    openFolder: string;
    retry: string;
    name: string;
    enabled: string;
    disabled: string;
    status: string;
    size: string;
    modified: string;
    source: string;
    role: string;
    selector: string;
    value: string;
    type: string;
    description: string;
    default: string;
    none: string;
    unknown: string;
    builtin: string;
    managed: string;
    unmanaged: string;
    absent: string;
    foreign: string;
    backup: string;
    reset: string;
    add: string;
    copy: string;
    copied: string;
    unsaved: string;
    dirty: string;
    expand: string;
    collapse: string;
  };
  shell: {
    commandPalette: string;
    commandPaletteHint: string;
    toggleSidebar: string;
    navigate: string;
    toggleTheme: string;
    language: string;
    searchPlaceholder: string;
    noResults: string;
    shortcuts: string;
    store: string;
    agent: string;
    agentSource: string;
    paletteMove: string;
    paletteRun: string;
    paletteClose: string;
  };
  pageDesc: {
    providers: string;
    models: string;
    roles: string;
    prompts: string;
    agentDir: string;
    mcp: string;
    tools: string;
    memory: string;
    settings: string;
  };
  overview: {
    title: string;
    version: string;
    providers: string;
    models: string;
    skills: string;
    mcpServers: string;
    memory: string;
    approval: string;
    links: string;
    rolesTitle: string;
    promptsTitle: string;
    resourcesTitle: string;
    quickLinks: string;
  };
  providers: {
    title: string;
    add: string;
    baseUrl: string;
    api: string;
    apiKey: string;
    authNone: string;
    strictTools: string;
    modelCount: string;
    apiKeySet: string;
    apiKeyMissing: string;
    probe: string;
    probing: string;
    probeResult: string;
    editTitle: string;
    newTitle: string;
    idHint: string;
    deleteConfirm: string;
    renameHint: string;
  };
  models: {
    title: string;
    defaultModel: string;
    selectDefault: string;
    setDefault: string;
    provider: string;
    contextWindow: string;
    maxTokens: string;
    reasoning: string;
    imageInput: string;
  };
  roles: {
    title: string;
    add: string;
    cycleOrder: string;
    cycleHint: string;
    deleteConfirm: string;
    selectorHint: string;
  };
  prompts: {
    title: string;
    risk: string;
    content: string;
    saveContent: string;
    restoreConfirm: string;
    enableConfirm: string;
    disableConfirm: string;
  };
  resources: {
    attach: string;
    detach: string;
    attachConfirm: string;
    deleteConfirm: string;
    restoreConfirm: string;
    foreignHint: string;
    managedHint: string;
    createPrompt: string;
    editorHint: string;
  };
  mcp: {
    title: string;
    add: string;
    transport: string;
    command: string;
    args: string;
    url: string;
    rawJson: string;
    adoptHint: string;
    deleteConfirm: string;
    invalidJson: string;
    nameHint: string;
  };
  tools: {
    title: string;
    builtin: string;
    managed: string;
    docTitle: string;
    discovered: string;
    hide: string;
  };
  memory: {
    title: string;
    backend: string;
    hint: string;
  };
  settings: {
    title: string;
    configured: string;
    unset: string;
    resetConfirm: string;
    tabs: string;
    enumHint: string;
    arrayHint: string;
  };
}

const zh: Strings = {
  appName: "omp 控制台",
  groups: {
    config: "配置",
    resources: "资源",
    system: "系统",
  },
  nav: {
    overview: "总览",
    providers: "服务商",
    models: "模型",
    roles: "模型角色",
    prompts: "系统提示词",
    skills: "技能",
    agents: "子代理",
    mcp: "MCP 服务",
    hooks: "钩子",
    tools: "工具",
    memory: "记忆",
    settings: "设置",
    extensions: "扩展",
  },
  common: {
    save: "保存",
    cancel: "取消",
    delete: "删除",
    edit: "编辑",
    create: "新建",
    close: "关闭",
    confirm: "确认",
    refresh: "刷新",
    loading: "加载中…",
    empty: "暂无内容",
    search: "搜索",
    adopt: "接管",
    restore: "还原备份",
    openFolder: "打开所在目录",
    retry: "重试",
    name: "名称",
    enabled: "已启用",
    disabled: "已停用",
    status: "状态",
    size: "大小",
    modified: "修改时间",
    source: "来源",
    role: "角色",
    selector: "选择器",
    value: "值",
    type: "类型",
    description: "说明",
    default: "默认",
    none: "无",
    unknown: "未知",
    builtin: "内置",
    managed: "已接管",
    unmanaged: "外部链接",
    absent: "未启用",
    foreign: "外部",
    backup: "备份",
    reset: "重置",
    add: "添加",
    copy: "复制",
    copied: "已复制",
    unsaved: "未保存",
    dirty: "有未保存的修改",
    expand: "展开",
    collapse: "收起",
  },
  shell: {
    commandPalette: "命令面板",
    commandPaletteHint: "搜索页面与操作",
    toggleSidebar: "切换侧栏",
    navigate: "跳转",
    toggleTheme: "切换主题",
    language: "语言",
    searchPlaceholder: "搜索页面与操作…",
    noResults: "无匹配结果",
    shortcuts: "快捷键",
    store: "存储目录",
    agent: "Agent 目录",
    agentSource: "来源",
    paletteMove: "移动",
    paletteRun: "执行",
    paletteClose: "关闭",
  },
  pageDesc: {
    providers: "models.yml",
    models: "{n} 个服务商",
    roles: "modelRoles",
    prompts: "~/.omp/agent/*.md",
    agentDir: "~/.omp/agent/{sub}",
    mcp: "mcp.json",
    tools: "tools/ · skills/",
    memory: "memory.backend",
    settings: "{n} 个配置项",
  },
  overview: {
    title: "总览",
    version: "omp 版本",
    providers: "服务商",
    models: "模型",
    skills: "技能",
    mcpServers: "MCP 服务",
    memory: "记忆后端",
    approval: "审批模式",
    links: "链接状态",
    rolesTitle: "模型角色",
    promptsTitle: "提示词开关",
    resourcesTitle: "资源概览",
    quickLinks: "快捷入口",
  },
  providers: {
    title: "服务商",
    add: "新建服务商",
    baseUrl: "Base URL",
    api: "API 协议",
    apiKey: "API Key",
    authNone: "无需鉴权",
    strictTools: "禁用严格工具校验",
    modelCount: "模型数量",
    apiKeySet: "已配置",
    apiKeyMissing: "未配置",
    probe: "探测模型",
    probing: "探测中…",
    probeResult: "探测到 {n} 个模型",
    editTitle: "编辑服务商",
    newTitle: "新建服务商",
    idHint: "仅限字母、数字、- 和 _",
    deleteConfirm: "确定删除服务商 {id} 及其全部模型？",
    renameHint: "修改 ID 会重命名服务商",
  },
  models: {
    title: "模型",
    defaultModel: "默认模型",
    selectDefault: "选择默认模型",
    setDefault: "设为默认",
    provider: "服务商",
    contextWindow: "上下文窗口",
    maxTokens: "最大输出",
    reasoning: "推理",
    imageInput: "图像输入",
  },
  roles: {
    title: "模型角色",
    add: "新增角色",
    cycleOrder: "循环顺序",
    cycleHint: "用逗号分隔角色名，决定切换模型的顺序",
    deleteConfirm: "确定删除角色 {role}？",
    selectorHint: "形如 provider/model，可带 :off 等后缀",
  },
  prompts: {
    title: "系统提示词",
    risk: "风险",
    content: "内容",
    saveContent: "保存内容",
    restoreConfirm: "确定用备份覆盖 {name} 的当前内容？",
    enableConfirm: "确定启用 {name}？",
    disableConfirm: "确定停用 {name}？",
  },
  resources: {
    attach: "启用",
    detach: "停用",
    attachConfirm: "确定接管 {name} 到存储目录？",
    deleteConfirm: "确定删除 {name}？会先归档到备份。",
    restoreConfirm: "确定用备份还原 {name}？",
    foreignHint: "该条目由外部（如 nix）管理，只读；先“接管”才能修改。",
    managedHint: "该条目由 omp-ctl 接管，修改会同步到存储目录。",
    createPrompt: "新建条目",
    editorHint: "编辑内容后保存；保存前会生成 .bak 备份。",
  },
  mcp: {
    title: "MCP 服务",
    add: "新增服务",
    transport: "传输方式",
    command: "命令",
    args: "参数",
    url: "URL",
    rawJson: "原始 JSON",
    adoptHint: "mcp.json 由外部管理，只读；点击“接管”后可编辑。",
    deleteConfirm: "确定删除 MCP 服务 {name}？",
    invalidJson: "JSON 格式错误",
    nameHint: "服务名不可包含 /",
  },
  tools: {
    title: "工具",
    builtin: "内置工具",
    managed: "自定义工具",
    docTitle: "工具文档",
    discovered: "已发现技能",
    hide: "隐藏",
  },
  memory: {
    title: "记忆",
    backend: "记忆后端",
    hint: "对应设置项 memory.backend；off 表示关闭。",
  },
  settings: {
    title: "设置",
    configured: "已显式配置",
    unset: "使用默认值",
    resetConfirm: "确定重置 {key} 为默认值？",
    tabs: "分类",
    enumHint: "从下列选项中选择",
    arrayHint: "JSON 数组，如 [\"a\",\"b\"]",
  },
};

const en: Strings = {
  appName: "omp Console",
  groups: {
    config: "Config",
    resources: "Resources",
    system: "System",
  },
  nav: {
    overview: "Overview",
    providers: "Providers",
    models: "Models",
    roles: "Model Roles",
    prompts: "System Prompts",
    skills: "Skills",
    agents: "Agents",
    mcp: "MCP Servers",
    hooks: "Hooks",
    tools: "Tools",
    memory: "Memory",
    settings: "Settings",
    extensions: "Extensions",
  },
  common: {
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    create: "Create",
    close: "Close",
    confirm: "Confirm",
    refresh: "Refresh",
    loading: "Loading…",
    empty: "Nothing here",
    search: "Search",
    adopt: "Adopt",
    restore: "Restore backup",
    openFolder: "Reveal in file manager",
    retry: "Retry",
    name: "Name",
    enabled: "Enabled",
    disabled: "Disabled",
    status: "Status",
    size: "Size",
    modified: "Modified",
    source: "Source",
    role: "Role",
    selector: "Selector",
    value: "Value",
    type: "Type",
    description: "Description",
    default: "Default",
    none: "None",
    unknown: "Unknown",
    builtin: "Built-in",
    managed: "Managed",
    unmanaged: "External link",
    absent: "Not enabled",
    foreign: "External",
    backup: "Backup",
    reset: "Reset",
    add: "Add",
    copy: "Copy",
    copied: "Copied",
    unsaved: "Unsaved",
    dirty: "Unsaved changes",
    expand: "Expand",
    collapse: "Collapse",
  },
  shell: {
    commandPalette: "Command palette",
    commandPaletteHint: "Search pages and actions",
    toggleSidebar: "Toggle sidebar",
    navigate: "Go to",
    toggleTheme: "Toggle theme",
    language: "Language",
    searchPlaceholder: "Search pages and actions…",
    noResults: "No results",
    shortcuts: "Shortcuts",
    store: "Store directory",
    agent: "Agent directory",
    agentSource: "Source",
    paletteMove: "Move",
    paletteRun: "Run",
    paletteClose: "Close",
  },
  pageDesc: {
    providers: "models.yml",
    models: "{n} providers",
    roles: "modelRoles",
    prompts: "~/.omp/agent/*.md",
    agentDir: "~/.omp/agent/{sub}",
    mcp: "mcp.json",
    tools: "tools/ · skills/",
    memory: "memory.backend",
    settings: "{n} keys",
  },
  overview: {
    title: "Overview",
    version: "omp version",
    providers: "Providers",
    models: "Models",
    skills: "Skills",
    mcpServers: "MCP servers",
    memory: "Memory backend",
    approval: "Approval mode",
    links: "Link states",
    rolesTitle: "Model roles",
    promptsTitle: "Prompt switches",
    resourcesTitle: "Resources",
    quickLinks: "Quick links",
  },
  providers: {
    title: "Providers",
    add: "New provider",
    baseUrl: "Base URL",
    api: "API protocol",
    apiKey: "API key",
    authNone: "No auth",
    strictTools: "Disable strict tool validation",
    modelCount: "Models",
    apiKeySet: "Configured",
    apiKeyMissing: "Missing",
    probe: "Probe models",
    probing: "Probing…",
    probeResult: "Found {n} models",
    editTitle: "Edit provider",
    newTitle: "New provider",
    idHint: "Letters, digits, - and _ only",
    deleteConfirm: "Delete provider {id} and all its models?",
    renameHint: "Changing the id renames the provider",
  },
  models: {
    title: "Models",
    defaultModel: "Default model",
    selectDefault: "Select default model",
    setDefault: "Set default",
    provider: "Provider",
    contextWindow: "Context window",
    maxTokens: "Max output",
    reasoning: "Reasoning",
    imageInput: "Image input",
  },
  roles: {
    title: "Model Roles",
    add: "New role",
    cycleOrder: "Cycle order",
    cycleHint: "Comma-separated role names, in model-cycling order",
    deleteConfirm: "Delete role {role}?",
    selectorHint: "provider/model, optional :suffix",
  },
  prompts: {
    title: "System Prompts",
    risk: "Risk",
    content: "Content",
    saveContent: "Save content",
    restoreConfirm: "Overwrite {name} with its backup?",
    enableConfirm: "Enable {name}?",
    disableConfirm: "Disable {name}?",
  },
  resources: {
    attach: "Enable",
    detach: "Disable",
    attachConfirm: "Adopt {name} into the store?",
    deleteConfirm: "Delete {name}? It is archived first.",
    restoreConfirm: "Restore {name} from backup?",
    foreignHint: "Externally managed (e.g. nix) and read-only; adopt it first to edit.",
    managedHint: "Managed by omp-ctl; edits sync to the store.",
    createPrompt: "New entry",
    editorHint: "Edit then save; a .bak backup is written before saving.",
  },
  mcp: {
    title: "MCP Servers",
    add: "New server",
    transport: "Transport",
    command: "Command",
    args: "Args",
    url: "URL",
    rawJson: "Raw JSON",
    adoptHint: "mcp.json is externally managed and read-only; adopt it to edit.",
    deleteConfirm: "Delete MCP server {name}?",
    invalidJson: "Invalid JSON",
    nameHint: "Server name cannot contain /",
  },
  tools: {
    title: "Tools",
    builtin: "Built-in tools",
    managed: "Custom tools",
    docTitle: "Tool docs",
    discovered: "Discovered skills",
    hide: "Hide",
  },
  memory: {
    title: "Memory",
    backend: "Memory backend",
    hint: "Maps to setting memory.backend; off disables it.",
  },
  settings: {
    title: "Settings",
    configured: "Explicitly set",
    unset: "Default",
    resetConfirm: "Reset {key} to its default?",
    tabs: "Categories",
    enumHint: "Pick one of these options",
    arrayHint: "JSON array, e.g. [\"a\",\"b\"]",
  },
};

const LOCALE_STRINGS: Record<Locale, Strings> = { zh, en };

function leaves(v: unknown, path: string, out: string[]) {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
      leaves(child, path ? `${path}.${k}` : k, out);
    }
    return;
  }
  out.push(path);
}

export function assertLocaleParity() {
  const base: string[] = [];
  leaves(zh, "", base);
  const missing: string[] = [];
  for (const locale of LOCALES) {
    const keys: string[] = [];
    leaves(LOCALE_STRINGS[locale], "", keys);
    const set = new Set(keys);
    for (const k of base) if (!set.has(k)) missing.push(`${locale}:${k}`);
    for (const k of keys) if (!base.includes(k)) missing.push(`${locale}!${k}`);
  }
  if (missing.length) {
    throw new Error(`locale key mismatch:\n${missing.join("\n")}`);
  }
}

export function strings(locale: Locale): Strings {
  return LOCALE_STRINGS[locale];
}
