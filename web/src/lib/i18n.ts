export const LOCALES = ["zh", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export interface PromptText {
  label: string;
  description: string;
}

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
    hooksPre: string;
    hooksPost: string;
    tools: string;
    memory: string;
    keybindings: string;
    settings: string;
    extensions: string;
    backup: string;
    workspaces: string;
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
    show: string;
    hide: string;
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
    theme: string;
    themeDark: string;
    themeLight: string;
    themeAuto: string;
    language: string;
    palette: string;
    font: string;
    fontSize: string;
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
    backup: string;
    keybindings: string;
    workspaces: string;
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
    apiCustom: string;
    apiCustomPlaceholder: string;
    apiKey: string;
    authNone: string;
    strictTools: string;
    modelCount: string;
    apiKeySet: string;
    apiKeyMissing: string;
    probe: string;
    probing: string;
    probeResult: string;
    fetchTitle: string;
    fetchAdd: string;
    fetchExists: string;
    fetchStale: string;
    fetchRemoveStale: string;
    selectAll: string;
    probeNoId: string;
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
    thinkingLevel: string;
    thinkingMode: string;
    thinkingEfforts: string;
    thinkingDefaultLevel: string;
    thinkingDefault: string;
    thinkingHint: string;
    unset: string;
  };
  roles: {
    title: string;
    add: string;
    cycleOrder: string;
    cycleHint: string;
    cycleToggle: string;
    cycleStale: string;
    deleteConfirm: string;
    selectorHint: string;
    quickAdd: string;
    thinkingLevel: string;
  };
  defaults: {
    title: string;
    roleThinkingLevel: string;
    roleThinkingLevelHint: string;
    modelDefaults: string;
    api: string;
    contextWindow: string;
    maxTokens: string;
    reasoning: string;
    imageInput: string;
    thinkingTitle: string;
    enableMaxThinking: string;
    enableMaxThinkingHint: string;
    save: string;
    backupTitle: string;
    backupEnabled: string;
    backupEnabledHint: string;
    backupKeep: string;
    backupKeepHint: string;
  };
  presets: {
    title: string;
    select: string;
    captureCurrent: string;
    deleteConfirm: string;
    namePrompt: string;
    empty: string;
    applied: string;
    workspaceSynced: string;
    saved: string;
    deleted: string;
    rename: string;
    renamed: string;
  };
  prompts: {
    title: string;
    risk: string;
    content: string;
    saveContent: string;
    restoreConfirm: string;
    enableConfirm: string;
    disableConfirm: string;
    items: {
      append_system: PromptText;
      rules: PromptText;
      agents: PromptText;
      system: PromptText;
    };
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
    unpack: string;
    agentModel: string;
    restoreDefault: string;
    restoreDefaultConfirm: string;
    reimportMissing: string;
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
  keybindings: {
    title: string;
    action: string;
    unknownAction: string;
    addAction: string;
    actionId: string;
    edit: string;
    recordHint: string;
    saveHint: string;
    disabled: string;
    overridden: string;
    reset: string;
    adopt: string;
    adoptHint: string;
  };
  settings: {
    title: string;
    appearance: string;
    appearanceColor: string;
    appearanceFont: string;
    appearanceLanguage: string;
    fontBundled: string;
    fontBundledHint: string;
    fontSystem: string;
    fontSystemHint: string;
    fontImport: string;
    fontImportHint: string;
    fontImportPrompt: string;
    fontImported: string;
    fontImportFailed: string;
    fontRemoveTitle: string;
    fontRemoveConfirm: string;
    systemLanguage: string;
    systemLanguageDetecting: string;
    searchHint: string;
    ompCtl: string;
    configured: string;
    unset: string;
    resetConfirm: string;
    tabs: string;
    enumHint: string;
    arrayHint: string;
  };
  backup: {
    title: string;
    export: string;
    exported: string;
    import: string;
    imported: string;
    pathLabel: string;
    pathPlaceholder: string;
    reveal: string;
    importConfirm: string;
  };
  workspaces: {
    title: string;
    create: string;
    namePlaceholder: string;
    apply: string;
    save: string;
    unselected: string;
    saveHint: string;
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
    hooksPre: "前置钩子",
    hooksPost: "后置钩子",
    tools: "工具",
    memory: "记忆",
    keybindings: "快捷键",
    settings: "设置",
    extensions: "扩展",
    backup: "备份迁移",
    workspaces: "工作区",
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
    show: "显示",
    hide: "隐藏",
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
    theme: "主题",
    themeDark: "深色",
    themeLight: "浅色",
    themeAuto: "跟随系统",
    palette: "配色方案",
    font: "字体",
    fontSize: "字号",
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
    backup: "store/backup/migrate-<ts>.tar.gz",
    keybindings: "~/.omp/agent/keybindings.yml",
    workspaces: "~/.omp-ctl/workspaces/<name>/",
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
    apiCustom: "自定义",
    apiCustomPlaceholder: "输入自定义协议",
    apiKey: "API Key",
    authNone: "无需鉴权",
    strictTools: "禁用严格工具校验",
    modelCount: "模型数量",
    apiKeySet: "已配置",
    apiKeyMissing: "未配置",
    probe: "探测模型",
    probing: "探测中…",
    probeResult: "探测到 {n} 个模型",
    fetchTitle: "扫描结果",
    fetchAdd: "添加模型",
    fetchExists: "已存在",
    fetchStale: "上游已移除",
    fetchRemoveStale: "移除失效模型",
    selectAll: "全选",
    probeNoId: "请先填写服务商 ID",
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
    thinkingLevel: "思考等级",
    thinkingMode: "传输模式",
    thinkingEfforts: "支持的等级",
    thinkingDefaultLevel: "该模型默认等级",
    thinkingDefault: "继承 omp 默认",
    thinkingHint:
      "不勾选任何等级则删除 thinking，沿用 omp 自动推断；勾选后写入 thinking.efforts，omp 才会允许角色选择这些等级。max 只有在这里勾选后才可选。",
    unset: "未设置",
  },
  roles: {
    title: "模型角色",
    add: "新增角色",
    cycleOrder: "循环顺序",
    cycleHint: "点选角色加入顺序，无效项标红，点红项可移除",
    cycleToggle: "点击切换 {role} 是否参与循环",
    cycleStale: "{role} 已不在角色列表中，点击移除",
    deleteConfirm: "确定删除角色 {role}？",
    selectorHint: "形如 provider/model，可带 :off 等后缀",
    quickAdd: "常用角色快捷添加",
    thinkingLevel: "思考强度",
  },
  defaults: {
    title: "默认值",
    roleThinkingLevel: "新增模型角色默认思考等级",
    roleThinkingLevelHint: "新增模型角色未指定等级时套用",
    modelDefaults: "模型字段默认",
    api: "API 协议",
    contextWindow: "上下文窗口",
    maxTokens: "最大输出",
    reasoning: "推理模型",
    imageInput: "支持图片",
    thinkingTitle: "思考等级",
    enableMaxThinking: "自动为推理模型启用 max",
    enableMaxThinkingHint:
      "开启并保存后立即应用到全部服务商；之后每次保存服务商都会把 max 并入所有推理模型的 thinking.efforts。无显式配置时按 API 推断 mode。关闭不会移除已写入的等级。",
    save: "保存默认值",
    backupTitle: "备份",
    backupEnabled: "启用写前备份（默认关闭）",
    backupEnabledHint: "关闭后不再产生 .bak.* 文件，已有备份保留不动",
    backupKeep: "保留数量",
    backupKeepHint: "每次写入后仅保留最新的 N 个备份（1–100，默认 5）",
  },
  presets: {
    title: "预设",
    select: "选择预设…",
    captureCurrent: "以当前配置新建",
    deleteConfirm: "删除预设 {name}？",
    namePrompt: "预设名称",
    empty: "还没有预设",
    applied: "已应用预设",
    workspaceSynced: "已同步到当前工作区（预设只改模型角色，工作区其余内容不变）",
    saved: "已保存预设",
    deleted: "已删除预设",
    rename: "重命名预设",
    renamed: "已重命名预设",
  },
  prompts: {
    title: "系统提示词",
    risk: "风险",
    content: "内容",
    saveContent: "保存内容",
    restoreConfirm: "确定用备份覆盖 {name} 的当前内容？",
    enableConfirm: "确定启用 {name}？",
    disableConfirm: "确定停用 {name}？",
    items: {
      append_system: {
        label: "追加系统提示词",
        description: "追加到默认系统提示词之后，保留内置工具与工作流指导。",
      },
      rules: {
        label: "硬性规则",
        description: "常驻规则，每次请求都会随上下文携带。",
      },
      agents: {
        label: "用户级全局上下文",
        description: "全局 AGENTS.md，对所有项目生效。",
      },
      system: {
        label: "替换系统提示词",
        description: "整块替换默认系统提示词，会丢失内置工具与工作流指导。",
      },
    },
  },
  resources: {
    attach: "启用",
    detach: "停用",
    attachConfirm: "确定接管 {name} 到存储目录？",
    deleteConfirm: "确定删除 {name}？会先归档到备份。",
    restoreConfirm: "确定用备份还原 {name}？",
    foreignHint: "该条目由外部管理，只读；先“接管”才能修改。",
    managedHint: "该条目由 omp-ctl 接管，修改会同步到存储目录。",
    createPrompt: "新建条目",
    editorHint: "编辑内容后保存；保存前会生成 .bak 备份。",
    unpack: "导入内置 Agents",
    agentModel: "使用模型（留空则跟随默认）",
    restoreDefault: "恢复内置默认",
    restoreDefaultConfirm: "确定用内置默认覆盖 {name}？当前内容会先备份。",
    reimportMissing: "补回缺失的内置 Agents",
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
  keybindings: {
    title: "快捷键",
    action: "按键",
    unknownAction: "未知 action",
    addAction: "添加绑定",
    actionId: "Action ID",
    edit: "编辑",
    recordHint: "点击此处后按下组合键进行录制",
    saveHint: "空列表表示禁用该 action",
    disabled: "已禁用",
    overridden: "已覆盖",
    reset: "恢复默认",
    adopt: "接管",
    adoptHint: "接管 keybindings.yml 后即可编辑",
  },
  settings: {
    title: "设置",
    appearance: "外观",
    appearanceColor: "配色方案",
    appearanceFont: "字体",
    appearanceLanguage: "语言",
    fontBundled: "寒蝉半圆体 Semibold（内置）",
    fontBundledHint: "随应用内置的中文圆体，覆盖界面所有文字",
    fontSystem: "跟随系统",
    fontSystemHint: "使用操作系统的默认界面字体",
    fontImport: "导入字体",
    fontImportHint: "支持 woff2 / woff / ttf / otf",
    fontImportPrompt: "输入字体文件的完整路径",
    fontImported: "字体已导入",
    fontImportFailed: "导入失败",
    fontRemoveTitle: "删除字体",
    fontRemoveConfirm: "确定删除字体「{name}」吗？文件会从 store 中移除。",
    systemLanguage: "系统语言",
    systemLanguageDetecting: "正在检测系统语言…",
    searchHint: "可以按中文名称、键名或英文说明搜索",
    ompCtl: "omp-ctl",
    configured: "已显式配置",
    unset: "使用默认值",
    resetConfirm: "确定重置 {key} 为默认值？",
    tabs: "分类",
    enumHint: "从下列选项中选择",
    arrayHint: "JSON 数组，如 [\"a\",\"b\"]",
  },
  backup: {
    title: "备份迁移",
    export: "导出备份",
    exported: "已导出到 {path}",
    import: "导入备份",
    imported: "已导入 {path}",
    pathLabel: "备份文件路径",
    pathPlaceholder: "~/.omp-ctl/store/backup/migrate-<ts>.tar.gz",
    reveal: "打开备份目录",
    importConfirm: "确定从 {path} 导入？当前文件会被备份。",
  },
  workspaces: {
    title: "工作区",
    create: "新建工作区",
    namePlaceholder: "如 coding",
    apply: "切换",
    save: "保存当前到此区",
    unselected: "未选中工作区，改动仅写当前配置",
    saveHint: "仅快照，不切换",
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
    hooksPre: "Pre-tool hooks",
    hooksPost: "Post-tool hooks",
    tools: "Tools",
    memory: "Memory",
    keybindings: "Keybindings",
    settings: "Settings",
    extensions: "Extensions",
    backup: "Backup",
    workspaces: "Workspaces",
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
    show: "Show",
    hide: "Hide",
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
    theme: "Theme",
    themeDark: "Dark",
    themeLight: "Light",
    themeAuto: "System",
    palette: "Palette",
    font: "Font",
    fontSize: "Text size",
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
    backup: "store/backup/migrate-<ts>.tar.gz",
    keybindings: "~/.omp/agent/keybindings.yml",
    workspaces: "~/.omp-ctl/workspaces/<name>/",
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
    apiCustom: "Custom",
    apiCustomPlaceholder: "Enter custom protocol",
    apiKey: "API key",
    authNone: "No auth",
    strictTools: "Disable strict tool validation",
    modelCount: "Models",
    apiKeySet: "Configured",
    apiKeyMissing: "Missing",
    probe: "Probe models",
    probing: "Probing…",
    probeResult: "Found {n} models",
    fetchTitle: "Probe results",
    fetchAdd: "Add models",
    fetchExists: "Exists",
    fetchStale: "Gone upstream",
    fetchRemoveStale: "Remove stale",
    selectAll: "Select all",
    probeNoId: "Fill in the provider ID first",
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
    thinkingLevel: "Thinking levels",
    thinkingMode: "Transport mode",
    thinkingEfforts: "Supported levels",
    thinkingDefaultLevel: "Model default level",
    thinkingDefault: "Inherit omp default",
    thinkingHint:
      "With no level selected the thinking block is removed and omp infers defaults. Selecting levels writes thinking.efforts, which is what makes them selectable for roles. max only appears there once enabled here.",
    unset: "Unset",
  },
  roles: {
    title: "Model Roles",
    add: "New role",
    cycleOrder: "Cycle order",
    cycleHint: "Click roles to build the order; invalid entries show red, click to remove",
    cycleToggle: "Toggle {role} in the cycle",
    cycleStale: "{role} is no longer a role, click to remove",
    deleteConfirm: "Delete role {role}?",
    selectorHint: "provider/model, optional :suffix",
    quickAdd: "Quick-add common roles",
    thinkingLevel: "Thinking level",
  },
  defaults: {
    title: "Defaults",
    roleThinkingLevel: "Default thinking level for new roles",
    roleThinkingLevelHint: "Applied to new roles without an explicit level",
    modelDefaults: "Model field defaults",
    api: "API protocol",
    contextWindow: "Context window",
    maxTokens: "Max output",
    reasoning: "Reasoning model",
    imageInput: "Image input",
    thinkingTitle: "Thinking levels",
    enableMaxThinking: "Auto-enable max for reasoning models",
    enableMaxThinkingHint:
      "Enabling and saving applies it to every provider immediately; later provider saves also merge max into thinking.efforts of all reasoning models. Without an explicit config the mode is inferred from the API. Turning it off does not remove levels already written.",
    save: "Save defaults",
    backupTitle: "Backups",
    backupEnabled: "Enable pre-write backups (off by default)",
    backupEnabledHint: "When off, no new .bak.* files are created; existing ones are kept",
    backupKeep: "Keep count",
    backupKeepHint: "Only the newest N backups are kept after each write (1–100, default 5)",
  },
  presets: {
    title: "Presets",
    select: "Select a preset…",
    captureCurrent: "Capture current",
    deleteConfirm: "Delete preset {name}?",
    namePrompt: "Preset name",
    empty: "No presets yet",
    applied: "Preset applied",
    workspaceSynced: "Synced to the active workspace (presets only change model roles; other workspace contents are untouched)",
    saved: "Preset saved",
    deleted: "Preset deleted",
    rename: "Rename preset",
    renamed: "Preset renamed",
  },
  prompts: {
    title: "System Prompts",
    risk: "Risk",
    content: "Content",
    saveContent: "Save content",
    restoreConfirm: "Overwrite {name} with its backup?",
    enableConfirm: "Enable {name}?",
    disableConfirm: "Disable {name}?",
    items: {
      append_system: {
        label: "Append system prompt",
        description: "Appended after the default system prompt; keeps built-in tools and workflow guidance.",
      },
      rules: {
        label: "Hard rules",
        description: "Always attached to every request context.",
      },
      agents: {
        label: "Global user context",
        description: "Global AGENTS.md applying to all projects.",
      },
      system: {
        label: "Replace system prompt",
        description: "Replaces the default system prompt wholesale; loses built-in tools and workflow guidance.",
      },
    },
  },
  resources: {
    attach: "Enable",
    detach: "Disable",
    attachConfirm: "Adopt {name} into the store?",
    deleteConfirm: "Delete {name}? It is archived first.",
    restoreConfirm: "Restore {name} from backup?",
    foreignHint: "Externally managed and read-only; adopt it first to edit.",
    managedHint: "Managed by omp-ctl; edits sync to the store.",
    createPrompt: "New entry",
    editorHint: "Edit then save; a .bak backup is written before saving.",
    unpack: "Import bundled agents",
    agentModel: "Model override (empty follows default)",
    restoreDefault: "Restore bundled default",
    restoreDefaultConfirm: "Overwrite {name} with the bundled default? Current content is backed up first.",
    reimportMissing: "Reimport missing bundled agents",
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
  keybindings: {
    title: "Keybindings",
    action: "Bindings",
    unknownAction: "Unknown action",
    addAction: "Add binding",
    actionId: "Action ID",
    edit: "Edit",
    recordHint: "Focus here, then press the key combination to record",
    saveHint: "An empty list disables the action",
    disabled: "Disabled",
    overridden: "Overridden",
    reset: "Reset",
    adopt: "Adopt",
    adoptHint: "Adopt keybindings.yml to enable editing",
  },
  settings: {
    title: "Settings",
    appearance: "Appearance",
    appearanceColor: "Colour scheme",
    appearanceFont: "Font",
    appearanceLanguage: "Language",
    fontBundled: "ChillRoundM Semibold (bundled)",
    fontBundledHint: "The rounded Chinese face shipped with the app, used for all UI text",
    fontSystem: "System default",
    fontSystemHint: "Use the operating system's default UI font",
    fontImport: "Import font",
    fontImportHint: "woff2, woff, ttf and otf are supported",
    fontImportPrompt: "Absolute path of the font file",
    fontImported: "Font imported",
    fontImportFailed: "Import failed",
    fontRemoveTitle: "Remove font",
    fontRemoveConfirm: "Remove the font “{name}”? The file is deleted from the store.",
    systemLanguage: "System language",
    systemLanguageDetecting: "Detecting the system language…",
    searchHint: "Search by label, key, or description",
    ompCtl: "omp-ctl",
    configured: "Explicitly set",
    unset: "Default",
    resetConfirm: "Reset {key} to its default?",
    tabs: "Categories",
    enumHint: "Pick one of these options",
    arrayHint: "JSON array, e.g. [\"a\",\"b\"]",
  },
  backup: {
    title: "Backup",
    export: "Export snapshot",
    exported: "Exported to {path}",
    import: "Import snapshot",
    imported: "Imported {path}",
    pathLabel: "Snapshot path",
    pathPlaceholder: "~/.omp-ctl/store/backup/migrate-<ts>.tar.gz",
    reveal: "Reveal backup dir",
    importConfirm: "Import from {path}? Current files will be backed up.",
  },
  workspaces: {
    title: "Workspaces",
    create: "New workspace",
    namePlaceholder: "e.g. coding",
    apply: "Switch",
    save: "Save current into this workspace",
    unselected: "No workspace selected; edits apply to current config only",
    saveHint: "Snapshot only; does not switch",
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
