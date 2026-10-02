# omp-ctl

Tauri 2 桌面 GUI，管理 omp 配置。`~/.omp-ctl/` 为唯一真实来源，
`~/.omp/agent/` 条目是指向它的 symlink。

## 架构

```
web/                    React + TypeScript + Vite + Tailwind v4 前端（bun 管理依赖）
  src/
    styles/app.css      唯一样式入口：@import "tailwindcss" + @theme token + @layer base
    lib/                ipc（Tauri 命令封装，读经 queryCache 做 30s SWR 缓存）、types（后端 DTO）、modelMeta（API/思考等级
                        常量与 selector 拼接）、chord（KeyboardEvent → 组合键字符串）、router、i18n、prefs、toast、
                        hotkeys、format、cn（clsx+tailwind-merge）
    hooks/              useAsync（加载/错误/reload）、useApp（全局上下文）
    components/ui/      UI 原语（Button/Input/Dialog/CodeEditor/Tabs/...），纯 Tailwind
    components/shell/   AppShell、Sidebar、Header、CommandPalette、PageContainer
    components/settings/ 设置页「omp-ctl」Tab 内容：DefaultsPanel（默认值）
    components/roles/   模型角色页组件：PresetBar（预设选择/应用/保存/删除）
    pages/              15 个路由页面（含 Backup 快照导出/导入、Keybindings 快捷键、Workspaces 工作区）
dist/                   `just web-build` 产物（gitignore，Tauri frontendDist）
src-tauri/src/
  lib.rs                Tauri 命令注册（57 个：52 + 5 工作区）+ SANDBOX_LOCK(cfg test)
  main.rs               3 行，调用 omp_ctl_lib::run()
  error.rs              AppError（serde tag="kind"）；Result<T, E = AppError>
  paths.rs              home/store_dir/agent_dir 解析 + DirInfo/DirSource（agent_dir 经 OnceLock 进程内缓存，避免每命令起 omp 子进程；cfg(test) 不缓存）
  proc.rs               omp 子进程封装
  store.rs              链接状态、接管、还原、原子写、.links.json、快照导出/导入；`backup_file -> Option`（默认关闭）
  backup.rs             写前备份开关 + 保留裁剪：`backup: {enabled, keep}`（`defaults.yml` 自有键，默认关闭/5 个，`backup/tests.rs`）
  yaml.rs               YamlDoc：行区间 YAML 编辑，保留注释
  models.rs             Provider/ModelEntry、读写、探测、模型目录（`models/tests.rs`）、默认模型
  roles.rs              modelRoles / cycleOrder
  defaults.rs           `~/.omp-ctl/defaults.yml`：新增模型/角色时套用的默认值 + 备份开关（`defaults/tests.rs`）
  presets.rs            `~/.omp-ctl/presets.yml`：整套 modelRoles + cycleOrder 命名预设，应用为整套替换（`presets/tests.rs`）；apply_preset 会清工作区 active 指针
  workspaces.rs         `~/.omp-ctl/workspaces/<名>/`：MCP/六类资源/四提示词/roles+cycleOrder+disabledAgents 快照，切换即整套覆盖；选中后各变更命令尾 sync_active_quiet() 自动同步（`workspaces/tests.rs`）
  keybindings.rs        `~/.omp/agent/keybindings.yml` 的行区间编辑、接管/还原与按键校验（`keybindings/tests.rs`）
  config_edit.rs        config.yml 嵌套标量写入（`config_edit/tests.rs`）
  settings.rs           `omp config list --json` 目录（`settings/tests.rs`）
  prompts.rs            四个提示词文件的状态与开关
  resources.rs          skills/agents/hooks/extensions/tools 枚举与读写（`resources/tests.rs`）
  mcp.rs                mcp.json 服务器增删改查（`mcp/tests.rs`）
  overview.rs           总览聚合
  harness.rs            无 Tauri 的入口，供集成测试调用
src-tauri/tests/
  real_agent_dir.rs     针对真实 agent 目录的集成测试
src-tauri/icons/         `cargo tauri icon` 生成的图标集（`bundle.icon` 引用）
.github/workflows/release.yml  推送 tag `v*` 触发三平台打包（Linux 仅 deb+rpm，无 AppImage）
```

## 关键约定

* [`Result`] 别名必须带默认错误参数：`pub type Result<T, E = AppError>`（rule `rs-result-type`）。
* 前端只用 `web/src/components/ui` 内原语，不引入新 UI 依赖；代码编辑用 `textarea` + 行号栏（`CodeEditor`），不用 CodeMirror。
* 样式统一用 Tailwind v4 工具类；类名拼接一律走 `cn()`（`web/src/lib/cn.ts`），不手写模板字符串。
* 主题为 `dark`/`light`/`auto` 三态，存 localStorage；`auto` 跟随 `prefers-color-scheme`。解析后的主题写入 `document.documentElement.dataset.theme`，浅色靠 `app.css` 的 `:root[data-theme="light"]` 变量覆盖实现，组件内不写 `dark:` 变体；色值 token 定义在 `@theme` 中，通过 `var(--color-*)` 使用。
* 每个页面最外层必须用 `PageContainer`（`{title, description?, actions?, children}`）；列表用全宽 `divide-y` 或 `<table>`，不叠 Card。
* `web/src/lib/ipc.ts` 的参数名必须与 Rust `#[tauri::command]` 参数名逐字一致（如 `oldId`/`newId`）。
* 所有写盘走 `store::write_atomic`，写前经 `backup_file` 生成 `.bak.<ts>`。
* `~/.omp/agent/` 的条目一律经 `store::adopt`/`adopt_rel` 接管；`link_state.kind == Managed` 时写目标必须是 store 路径，否则会覆盖 symlink。
* YAML 只做行区间替换（`yaml.rs`），不得整体重排文件。
* 缩进探测用 `chars().take_while(' ')`，不要用 `len - trim_start_matches` 之差。
* 测试若改动 `$HOME`/环境变量，必须持有 `crate::SANDBOX_LOCK`。
* 默认值存 `~/.omp-ctl/defaults.yml`、预设存 `~/.omp-ctl/presets.yml`，均为 omp-ctl 自有功能，不写 `config.yml`（避免 omp 读到未知键），不进快照。默认值 UI 在「设置」页首个 Tab「omp-ctl」（`components/settings/`）；预设是 modelRoles+cycleOrder 的快照，UI 在「模型角色」页顶部工具条（`components/roles/PresetBar`），不单独占导航项。
* 默认模型只由「模型」页维护（`modelRoles.default`）；「omp-ctl」Tab 不再重复提供该选择器。
* 预设是受管模式：下拉选中即整套替换应用，此后页面上的每次改动同时写回 `config.yml` 和该预设（`save_preset` 逐次同步 `modelRoles` + `cycleOrder`）。预设条只有「新建」，没有「覆盖」按钮；未选中任何预设时只写 `config.yml`。
* `keybindings.yml` 与 `config.yml`/`mcp.json` 同为接管对象；action 表是内置静态表，未知 action 原样保留可编辑（`known: false`），不改动文件里已有的未知键。
* 无注释，除非 WHY 不明显（隐式约束、反直觉行为）。

## 命令

```sh
nix develop     # 进入开发 shell（rust-overlay + tauri/webkit 依赖）
just web-install # cd web && bun install
just web-check  # 前端类型检查（tsc --noEmit）
just web-build  # 构建前端到 dist/
just serve      # 单独在 1420 端口跑 Vite（仅调试前端时用）
just dev        # 启动 Tauri 窗口（beforeDevCommand 自动拉起 Vite）
just check-rust # cargo check
just build      # cargo tauri build（全默认包）；Release CI 按平台传 --bundles（linux deb,rpm / win nsis,msi / mac app,dmg）
just fmt-rust   # cargo fmt
```

`just dev` 已由 `beforeDevCommand` 自动启动 Vite，无需另开 `just serve`。

## 测试要求

* 测试必须走**真实** agent 目录；`PI_CODING_AGENT_DIR` 的探测不可靠。
* 集成测试在无法解析 agent 目录时自行跳过。

## 变更需同步文档

架构、开发约定、命令、文件结构变更时同步本文件。
