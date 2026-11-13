# omp-ctl

Tauri 2 桌面 GUI，管理 omp 配置。`~/.omp-ctl/` 为唯一真实来源，
`~/.omp/agent/` 条目是指向它的 symlink。

## 架构

```
web/                    React + TypeScript + Vite + Tailwind v4 前端（bun 管理依赖）
  src/
    styles/app.css      唯一样式入口：M3 token 层（@theme 映射 --m3-*）+ 字体 + 动效；palettes.css 由
                        `bun run gen:palettes` 生成（scripts/gen-palettes.mjs，M3 tonal-spot 10 套配色）
    lib/                appearance（配色/字体）、settingLabels（设置项中文名）、settingDescriptions（406 条设置说明中文）、ipc（Tauri 命令封装，读经 queryCache 做 30s SWR 缓存）、types（后端 DTO）、modelMeta（API/思考等级
                        常量与 selector 拼接）、chord（KeyboardEvent → 组合键字符串）、router、i18n、prefs、toast、
                        hotkeys、format、cn（clsx+tailwind-merge）、scanRows（探测对话框行合并：上游在线 + 已配置但上游已移除）
    hooks/              useAsync（加载/错误/reload）、useApp（全局上下文）
    components/ui/      UI 原语（Button/Input/Select/Dialog/CodeEditor/Tabs/...），纯 Tailwind；`Select` 是 M3 菜单，非原生 `<select>`
    components/shell/   AppShell、Sidebar、Header、CommandPalette、PageContainer
    components/settings/ 设置页「omp-ctl」Tab 内容：DefaultsPanel（默认值）
    components/roles/   模型角色页组件：PresetBar（预设选择/应用/新建/重命名/删除）
    pages/              15 个路由页面（含 Backup 快照导出/导入、Keybindings 快捷键、Workspaces 工作区）
dist/                   `just web-build` 产物（gitignore，Tauri frontendDist）
src-tauri/src/
  fonts.rs              `~/.omp-ctl/fonts/`：导入/列出/删除/读取自定义字体（`fonts/tests.rs`）
  lib.rs                Tauri 命令注册（71 个：66 + 5 工作区）+ SANDBOX_LOCK(cfg test)；命令一律 async + offload(spawn_blocking)，否则阻塞体跑在 IPC 主线程会卡窗口
  main.rs               3 行，调用 omp_ctl_lib::run()
  error.rs              AppError（serde tag="kind"）；Result<T, E = AppError>
  paths.rs              home/store_dir/agent_dir 解析 + DirInfo/DirSource（agent_dir 经 OnceLock 进程内缓存，避免每命令起 omp 子进程；cfg(test) 不缓存）
  proc.rs               omp 子进程封装：PATH/`OMP_BIN`/常见安装目录解析 `omp`（Windows 认 `.exe`/`.cmd`），子进程带 CREATE_NO_WINDOW
  store.rs              链接状态（LinkMode：symlink/junction/copy）、接管、还原、原子写、.links.json、快照导出/导入；无符号链接权限时用目录 junction 或双写副本（`sync_copies`/`content_path`/`persist_managed` 保证两侧一致）；`backup_file -> Option`（默认关闭）
  backup.rs             写前备份开关 + 保留裁剪：`backup: {enabled, keep}`（`defaults.yml` 自有键，默认关闭/5 个，`backup/tests.rs`）
  yaml.rs               YamlDoc：行区间 YAML 编辑，保留注释
  models.rs             Provider/ModelEntry、读写、探测、模型目录（`models/tests.rs`）、默认模型
  roles.rs              modelRoles / cycleOrder
  defaults.rs           `~/.omp-ctl/defaults.yml`：新增模型/角色时套用的默认值 + 备份开关（`defaults/tests.rs`）
  presets.rs            `~/.omp-ctl/presets.yml`：整套 modelRoles + cycleOrder 命名预设（增/删/重命名），应用为整套替换（`presets/tests.rs`）；apply_preset 会清工作区 active 指针
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
web/public/fonts/          内置寒蝉半圆体（ChillRoundM，Zen Maru Gothic 的 pyftsubset 子集，OFL-1.1，见同目录 OFL.txt）
src-tauri/icons/         `cargo tauri icon` 从 `source.svg` 生成的图标集（`bundle.icon` 引用）；改图标只改 source.svg 再重新生成
packaging/aur/           AUR 包：每个包一个子目录（omp-ctl 源码构建 / omp-ctl-bin 展开 release 的 .deb）+ publish.sh（本地与 CI 共用的发布脚本）
.github/workflows/release.yml  推送 tag `v*` 触发三平台打包（Linux 仅 deb+rpm，无 AppImage）；`aur` job 随后调 packaging/aur/publish.sh 推 AUR（secret `AUR_SSH_KEY`），拆成独立 workflow 不会被 GITHUB_TOKEN 的 release 事件触发
```

## 关键约定

* [`Result`] 别名必须带默认错误参数：`pub type Result<T, E = AppError>`（rule `rs-result-type`）。
* 前端只用 `web/src/components/ui` 内原语，不引入新 UI 依赖；代码编辑用 `textarea` + 行号栏（`CodeEditor`），不用 CodeMirror。
* 样式统一用 Tailwind v4 工具类；类名拼接一律走 `cn()`（`web/src/lib/cn.ts`），不手写模板字符串。
* 一切视觉走 Material Design 3：`app.css` 只声明 token 与动效，配色来自 `palettes.css` 的 `--m3-*`（10 套 tonal-spot 方案），组件一律用 `var(--color-*)`／`var(--radius-*)`，不写 `dark:` 变体。主题 `dark`/`light`/`auto` 与配色、字体都存 localStorage，默认浅色 + 寒蝉半圆体；`auto` 跟随 `prefers-color-scheme`，语言默认跟随系统（`system_locale`）。配色与明暗切换都由 `reveal()`（`AppShell.tsx`）给出圆形的扩散过渡：先提交新配色，再从点击点扩散一层中性色圆盘并淡出。**不要**试图用 DOM 克隆做 MaskAnim 式擦除：`#root` 是 flex 子项，脱离文档后会塌成 0 高，克隆层是一张空白全屏遮罩，且移除回调不触发，会把窗口永久涂黑（已实测踩过）。View Transitions 同样不可用：此 WebKitGTK 声明 `startViewTransition` 却永不 resolve。`index.html` 的内联脚本先定一次配色与色调，避免首帧闪烁。
* 明暗只有两态：`ThemePref = "dark" | "light"`，首次启动跟随系统（`hasThemeChoice()` 为假时由 `prefers-color-scheme` 决定），首次手动切换才落盘。配色只在 `AppShell` 的单个 `useEffect` 里 `applyPalette`，不要在 `setPalette`/`changeTheme` 里重复调用——两处写盘会让后一次 effect 用上一轮的派生 tone 覆盖刚切好的明暗。
* 图标统一由 `svg.lucide` 的 `stroke-width`/圆角衔接覆盖，不在调用处逐个调线宽。
* 输入类控件用**描边式**（`CONTROL_BASE`）：`--color-surface-2` 与页面底色只差 1.11:1，填充式在本项目的 tonal-spot 配色下不可见；边界必须靠 `--color-border-strong` 的实线画出（实测 5.83:1）。不要改回填充式或只靠色阶区分。
* 全局 `button/a/input/...` 的 transition 只允许合成属性（background-color/color/transform/opacity）。此前包含 `box-shadow` 与 `border-color`，两者逐帧触发重绘；展开的服务商表单里有 80+ 控件，滚动时是成百个重绘目标。
* 高度动画（`.collapsible` 的 `grid-template-rows: 0fr→1fr`）必须 `animation-fill-mode: backwards`，且基类不能写成 `1fr`——否则首帧已是终态，高度不会动，只剩透明度在变。
* 列表行若要有完整圆角，行内不能铺满容器宽度：`overflow-x-auto` + 满宽 background 会把左右圆角切掉。行用 `px-3` 的内缩胶囊，容器给 `-mx-1 px-1` 留出裁切余量。
* 可点击面必须带 M3 state layer：用 `useRipple()`（`web/src/lib/ripple.ts`）返回的 `ripple` + `rippleTarget`，宿主自己 `relative isolate overflow-hidden`，波纹才能被自身圆角裁住。只给大容器加、不给行内小控件加会看起来像没实现。
* 默认配色是青绿（`DEFAULT_PALETTE = "teal"`）；改默认值要同时改 `scripts/gen-palettes.mjs`、`palettes.ts`、`index.html` 内联脚本三处。
* 主题揭示的克隆层必须冻结：`.theme-mask *` 关闭所有 animation/transition，否则入场动画会在冻结帧里重放，观感等同页面刷新。
* 每个页面最外层必须用 `PageContainer`（`{title, description?, actions?, children}`）；列表用全宽 `divide-y` 或 `<table>`，不叠 Card。
* `web/src/lib/ipc.ts` 的参数名必须与 Rust `#[tauri::command]` 参数名逐字一致（如 `oldId`/`newId`）。
* 所有写盘走 `store::write_atomic`，写前经 `backup_file` 生成 `.bak.<ts>`。
* `~/.omp/agent/` 的条目一律经 `store::adopt`/`adopt_rel` 接管；`link_state.kind == Managed` 时写目标必须是 store 路径，否则会覆盖 symlink。
* YAML 只做行区间替换（`yaml.rs`），不得整体重排文件。
* 缩进探测用 `chars().take_while(' ')`，不要用 `len - trim_start_matches` 之差。
* 测试若改动 `$HOME`/环境变量，必须持有 `crate::SANDBOX_LOCK`。
* 默认值存 `~/.omp-ctl/defaults.yml`、预设存 `~/.omp-ctl/presets.yml`，均为 omp-ctl 自有功能，不写 `config.yml`（避免 omp 读到未知键），不进快照。默认值 UI 在「设置」页首个 Tab「omp-ctl」（`components/settings/`）；预设是 modelRoles+cycleOrder 的快照，UI 在「模型角色」页顶部工具条（`components/roles/PresetBar`），不单独占导航项。
* 默认模型只由「模型」页维护（`modelRoles.default`）；「omp-ctl」Tab 不再重复提供该选择器。
* 模型可选思考等级只来自 `omp models --json` 的 `thinking`；要让 `max` 可选必须在模型条目写 `thinking: { mode, efforts }`（`mode` 必填）。`thinkingLevelMap` 被 omp 忽略，不再写入（已有内容原样保留）。设置页的「自动为推理模型启用 max」开启并保存后会立即应用到全部服务商，之后每次保存服务商也会把 `max` 并入所有 reasoning 模型的 `thinking.efforts`（保留现有 `mode`/`defaultLevel`/未知键，无显式配置时按 API 推断 `mode`，等级取目录实际值、失败回退默认阶梯）。
* 预设是受管模式：下拉选中即整套替换应用，此后页面上的每次改动同时写回 `config.yml` 和该预设（`save_preset` 逐次同步 `modelRoles` + `cycleOrder`）。预设条只有「新建」，没有「覆盖」按钮；未选中任何预设时只写 `config.yml`。
* `keybindings.yml` 与 `config.yml`/`mcp.json` 同为接管对象；action 表是内置静态表，未知 action 原样保留可编辑（`known: false`），不改动文件里已有的未知键。
* 工作区在应用启动和 `list_workspaces` 时调用 `repair_active()` 自动修复当前激活工作区的断链：只补链接、恢复缺失的 store 文件，不重放 roles/config；快照或 store 中存在但 manifest 未记录的条目按启用处理，显式 `false` 仍不链接。
* AUR 包定义只有 `packaging/aur/<包名>/PKGBUILD` 一份，本地与 CI 都走 `publish.sh <tag> [pkgrel] [包名...]`：它按 tag 重写 `pkgver`/`pkgrel`/`sha256sums`（sha 取 `source[0]` 的下载结果）、用 `makepkg --printsrcinfo` 生成 `.SRCINFO`，推送成功后**把改写结果写回仓库**，所以仓库里的 PKGBUILD 始终等于 AUR 上的版本。不带包名参数就发布全部包（CI 的 matrix 每次只传一个，一个失败不影响另一个）。不要手改 AUR 仓库内容。
* AUR 的 `omp-ctl` 与 `omp-ctl-bin` 都必须在 PKGBUILD 里带 `--features tauri/custom-protocol`（前者是 `cargo build` 参数，后者是 CI 打包产物天然具备）：`tauri::is_dev() = !cfg!(feature = "custom-protocol")`，缺了它二进制去连 `devUrl`（127.0.0.1:1420），装完打开就是一个连不上的窗口。同理，本地 `cargo tauri build` 不要手写 `cargo build` 代替。
* 升版本号要改 `src-tauri/Cargo.toml` + `src-tauri/tauri.conf.json` + 刷新并提交 `Cargo.lock`；漏提交 lock 会让 AUR 的 `cargo build --locked` 失败。
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
packaging/aur/publish.sh v0.6.0  # 生成 .SRCINFO 并把 PKGBUILD 推到 AUR（用 ~/.ssh/aur，makepkg 拒绝 root）；第二参数 pkgrel，第三起为包名（默认全部）
```

`just dev` 已由 `beforeDevCommand` 自动启动 Vite，无需另开 `just serve`。

## 测试要求

* 测试必须走**真实** agent 目录；`PI_CODING_AGENT_DIR` 的探测不可靠。
* 集成测试在无法解析 agent 目录时自行跳过。

## 变更需同步文档

架构、开发约定、命令、文件结构变更时同步本文件。
