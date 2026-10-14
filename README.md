# omp-ctl

Desktop GUI (Tauri 2) for managing [omp](https://omp.sh) configuration.

English | [简体中文](README.zh-CN.md)

![Overview](docs/screenshots/overview.png)

## Features

- **Providers & models** (`models.yml`): browse / create / edit / delete providers, edit each provider's model list, probe a provider's `/v1/models`, set any model as default (writes `modelRoles.default` in `config.yml`).
- **Roles & cycle order** (`config.yml` `modelRoles` + `cycleOrder`): role-to-model mapping rows plus the model cycle order.
- **Presets** (`presets.yml`): named snapshots of the whole `modelRoles` + `cycleOrder` set. Managed mode — selecting a preset applies the whole set, every later edit writes back to both `config.yml` and the preset, there is no overwrite button. Applying a preset clears the workspace active pointer sync (workspace snapshot follows via `sync_active_roles`).
- **Workspaces** (`workspaces/<name>/`): snapshots of MCP servers, six resource kinds, four prompt files, roles + cycleOrder + disabledAgents. Save captures the current state, apply overwrites the store wholesale; while a workspace is active, each change command tails `sync_active_quiet()` so the snapshot auto-follows.
- **MCP servers** (`mcp.json`): add / edit / delete servers plus an enabled switch.
- **Resources** (skills / agents / hooks / extensions / tools / memory): skills live in `SKILL.md` directory layout, agents/hooks/extensions/tools/memory as files with their own extensions; unmanaged entries can be adopted, foreign ones stay read-only.
- **Prompts** (`APPEND_SYSTEM.md`, `RULES.md`, `AGENTS.md`, `SYSTEM.md`): independent per-file link switches, editable content, backup restore; unmanaged files go through an adopt flow that never rewrites the external target.
- **Keybindings** (`keybindings.yml`): 22 built-in actions with chord validation (must end with a key, not a modifier); unknown actions in the file are kept verbatim and remain editable.
- **Settings**: searchable table grouped into tabs parsed from `omp config list`, with a `configured` mark; set / reset goes through the omp CLI.
- **Backup & snapshots**: export produces a `migrate-<ts>.tar.gz` under `backup/` covering config, models, mcp.json, keybindings.yml, `.links.json`, managed files and all resource dirs; import stages to a temp dir, refuses symlink entries and empty snapshots. `defaults.yml` / `presets.yml` are omp-ctl's own and are excluded.
- **Defaults** (`defaults.yml`): defaults applied when creating new models / roles, plus the backup switch `backup: {enabled, keep}` (default off / keep 5).

## Screenshots

![Overview — stat cards, roles, prompts and quick links](docs/screenshots/overview.png)

![Providers — provider table](docs/screenshots/providers.png)

![Models — model table and default-model selector](docs/screenshots/models.png)

![Roles — role mapping, cycle order and preset bar](docs/screenshots/roles.png)

![MCP — server list](docs/screenshots/mcp.png)

![Tools — built-in tools tab](docs/screenshots/tools.png)

![Settings — searchable settings table](docs/screenshots/settings.png)

## Install

**Arch Linux (AUR)** — the two packages are mutually exclusive (`provides`/`conflicts`):

```sh
yay -S omp-ctl      # build from source (needs bun + cargo, several minutes with LTO)
yay -S omp-ctl-bin  # prebuilt: unpacks the release .deb, x86_64 only
```

Package definitions live in [`packaging/aur/`](packaging/aur/).

**Other platforms**: download from [Releases](https://github.com/moecly/omp-ctl/releases) — `.exe` (NSIS) / `.msi` on Windows, `.dmg` / `.app.tar.gz` on macOS, `.deb` / `.rpm` on Linux. AppImage is only produced by a local `just build`, CI does not ship it.

## Core concepts

`~/.omp-ctl/` is the single source of truth; entries under `~/.omp/agent/` are symlinks pointing into it.

Link state is a tri-state, not on/off (`Absent` / `Managed` / `Unmanaged`): config and models are resident files, so "disabled" still has content in the store.

- Disabling a feature removes the link; the content stays in the store, nothing is lost.
- Enabling a feature creates the link.
- First-time adoption copies the entity into the store and moves the original into `~/.omp-ctl/backup/` (recorded in `.links.json`); restore moves it back, keeping the store copy.

## Development

`just dev` starts the Tauri window; its `beforeDevCommand` launches Vite automatically. Do NOT open a second `just serve` alongside it — `strictPort: 1420` will conflict. `just serve` is for frontend-only debugging.

| Command | What it does |
|---|---|
| `nix develop` | Enter the dev shell (rust-overlay + Tauri/WebKit deps) |
| `just web-install` | `cd web && bun install` |
| `just web-check` | Frontend type check (`tsc --noEmit`) |
| `just web-build` | Build frontend into `dist/` |
| `just serve` | Vite on port 1420, frontend only |
| `just dev` | Tauri window (Vite starts automatically) |
| `just check-rust` | `cargo check` |
| `just test` | Rust tests |
| `just build` | `cargo tauri build` (also emits AppImage locally) |
| `just fmt-rust` | `cargo fmt` |

On Wayland with garbled WebKit rendering: `WEBKIT_DISABLE_DMABUF_RENDERER=1 GDK_BACKEND=x11` (already baked into `just dev`).

Frontend lives in `web/` (React + TypeScript + Vite + Tailwind v4, `bun` for deps).

## Release

1. 升版本号，共四处但只有前两处要手改：
   * `src-tauri/Cargo.toml` 的 `version`
   * `src-tauri/tauri.conf.json` 的 `version`（决定 deb/rpm/msi 产物的版本号）
   * `Cargo.lock` —— 由 cargo 自己刷新，**必须一起提交**：AUR 构建用
     `cargo build --release --locked`，lock 里 `omp-ctl` 的旧版本号会让它直接失败
     （本地 `just build` 不带 `--locked`，会静默修好 lock，所以只有 AUR CI 会暴露）。
     `cargo check` 或任意不带 `--locked` 的 cargo 命令都会顺手刷新它。
   * `packaging/aur/*/PKGBUILD` 不用动：`publish.sh` 按 tag 重写 `pkgver`/`pkgrel`/`sha256sums`，
     发布成功后还会把改写结果**写回仓库**，所以仓库里的 PKGBUILD 永远等于 AUR 上的版本。
2. 打 tag 并推送：`git tag v0.8.1 && git push origin v0.8.1`。
   **tag 必须打在包含 `packaging/aur/` 最新内容的提交上**：`aur` job 用的是 tag 树里的
   包定义与 `publish.sh`，打在旧提交上会拿旧脚本发布（0.7.0 就这么丢过 `omp-ctl-bin`，
   而且发出的 `omp-ctl` 是缺 `custom-protocol` 的旧 PKGBUILD 编出来的）。
3. `release.yml` 的 `release` job 在三平台打包并建出 GitHub Release（deb / rpm / nsis+msi / app+dmg，CI 不出 AppImage；本地 `just build` 会额外产出 AppImage）。
4. 同一个 workflow 的 `aur` job（`needs: release`）在 Arch 容器里对
   `packaging/aur/` 下的每个包各跑一次 `publish.sh <tag> 1 <包名>`（matrix + `fail-fast: false`，
   一个包失败不影响另一个），把 PKGBUILD 与 .SRCINFO 推到 AUR。
   需要仓库 secret `AUR_SSH_KEY`（AUR 账户里登记的 ed25519 私钥，无口令）。
   不能拆成独立 workflow：release 由 `GITHUB_TOKEN` 创建，GitHub 不会用它触发新 workflow。

手动补发（本地，用 `~/.ssh/aur`，`AUR_KEY_FILE` 可改）：

```sh
packaging/aur/publish.sh v0.8.1              # 全部包，pkgrel=1
packaging/aur/publish.sh v0.8.1 2 omp-ctl    # 只发 omp-ctl，pkgrel=2（同版本重打包）
```

本地 `makepkg` 手动试打（在 `packaging/aur/omp-ctl/` 里复制 PKGBUILD 到空目录再 `makepkg -f`）
必须带上 `--features tauri/custom-protocol`——PKGBUILD 已经写了，别删：缺了它编出来的是
dev 模式二进制，运行时去连 `127.0.0.1:1420`（Vite）而不是内嵌前端，装完打开就是个连不上的窗口。

AUR 账户与密钥准备：

1. 到 <https://aur.archlinux.org/register/> 注册。**注册不设密码**：账户先以空密码 + resetkey
   落库，必须点开邮件里的设置密码链接才可用 —— AUR 的 git 认证在 SQL 里显式要求
   `NOT Users.Passwd = ''`（`aurweb/git/auth.py`），没走完这一步的账户即使公钥已登记，
   SSH 也永远是 `Permission denied (publickey)`。
2. `ssh-keygen -t ed25519 -f ~/.ssh/aur`，登录后把 **`~/.ssh/aur.pub`** 内容填进
   <https://aur.archlinux.org/account/> 的 `SSH Public Key` 并保存。
3. 把 **`~/.ssh/aur` 私钥全文**（含 `BEGIN/END` 行，不是 `.pub`）存成仓库 secret `AUR_SSH_KEY`。

AUR 的 SSH 认证条件只有三条（`aurweb/git/auth.py`）：该公钥存在于此账户、账户未被
suspended、账户已设密码。`Permission denied (publickey)` 必然是不满足其中之一，与 GitHub 侧
配置无关。`publish.sh` 每次运行先打印所用私钥指纹并校验私钥可用；CI 另有一页直接探测
`aur@aur.archlinux.org` 的认证，失败时用 `::error::` 指出上述原因。

## Layout

```
~/.omp-ctl/
├── models.yml            # managed real file
├── config.yml
├── mcp.json
├── keybindings.yml
├── defaults.yml          # omp-ctl's own, not snapshotted
├── presets.yml           # omp-ctl's own, not snapshotted
├── SYSTEM.md  APPEND_SYSTEM.md  AGENTS.md  RULES.md
├── models.yml.bak.<ts>   # co-located pre-write backups (when enabled)
├── .links.json           # adoption records (original target, backup name)
├── workspaces/<name>/    # per-workspace snapshots + workspace.json
└── backup/               # adopted originals + migrate-*.tar.gz snapshots
```

Entries under `~/.omp/agent/` are symlinks to the files above.

## Agent dir resolution

1. `omp config path`
2. `PI_CODING_AGENT_DIR`
3. `OMP_PROFILE` / `PI_PROFILE` (skipping `default`, `blank`)
4. `$XDG_DATA_HOME/omp/agent` (only if the dir exists)
5. `$HOME/.omp/agent`

The resolved dir is cached in-process via `OnceLock` (uncached under `cfg(test)`). Integration tests run against a real agent dir and self-skip when none resolves.

## Write policy

- Pre-write backups go through `backup_file` and are gated by `backup.enabled` (**default OFF**); `keep` defaults to 5, clamped to 0–100, older `.bak.<ts>` siblings pruned.
- All writes use tmp-file + `rename` atomic replacement (`store::write_atomic`).
- YAML edits are row-range replacements (`yaml.rs`) that preserve comments and unmodeled fields.
