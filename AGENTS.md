# omp-ctl

Tauri 2 桌面 GUI，管理 omp 配置。`~/.omp-ctl/` 为唯一真实来源，
`~/.omp/agent/` 条目是指向它的 symlink。

## 架构

```
dist/                 无构建步骤的静态前端（index.html / style.css / app.js）
src-tauri/src/
  lib.rs              Tauri 命令注册 + SANDBOX_LOCK(cfg test)
  main.rs             3 行，调用 omp_ctl_lib::run()
  error.rs            AppError（serde tag="kind"）；Result<T, E = AppError>
  paths.rs            home/store_dir/agent_dir 解析 + DirInfo/DirSource
  store.rs            链接状态、接管、还原、原子写、.links.json
  yaml.rs             YamlDoc：行区间 YAML 编辑，保留注释
  models.rs           Provider/ModelEntry、读写、探测、默认模型
  config_edit.rs      config.yml 嵌套标量写入
  prompts.rs          四个提示词文件的状态与开关
  harness.rs          无 Tauri 的入口，供集成测试调用
src-tauri/tests/
  real_agent_dir.rs   针对真实 agent 目录的集成测试
```

## 关键约定

* [`Result`] 别名必须带默认错误参数：`pub type Result<T, E = AppError>`（rule `rs-result-type`）。
* 前端无构建步骤；新增模式一律沿用 `dist/` 内的原生 JS 写法。
* 所有写盘走 `store::write_atomic`，写前经 `backup_file` 生成 `.bak.<ts>`。
* YAML 只做行区间替换（`yaml.rs`），不得整体重排文件。
* 缩进探测用 `chars().take_while(' ')`，不要用 `len - trim_start_matches` 之差。
* 测试若改动 `$HOME`/环境变量，必须持有 `crate::SANDBOX_LOCK`。
* 无注释，除非 WHY 不明显（隐式约束、反直觉行为）。

## 命令

```sh
nix develop     # 进入开发 shell（rust-overlay + tauri/webkit 依赖）
just serve      # 在 1420 端口提供 dist/（Tauri devUrl 依赖）
just dev        # 启动 Tauri 窗口
just check-rust # cargo check
just test       # cargo test
just fmt-rust   # cargo fmt
just build      # cargo tauri build
```

`just dev` 前必须先在另一终端运行 `just serve`，否则 Tauri 会一直等待前端。

## 测试要求

* 测试必须走**真实** agent 目录；`PI_CODING_AGENT_DIR` 的探测不可靠。
* 集成测试在无法解析 agent 目录时自行跳过。

## 变更需同步文档

架构、开发约定、命令、文件结构变更时同步本文件。
