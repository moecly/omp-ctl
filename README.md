# omp-ctl

用于管理 [omp](https://omp.sh) 配置的桌面 GUI（Tauri 2）。

核心设计：`~/.omp-ctl/` 是唯一真实来源（single source of truth），
`~/.omp/agent/` 下的条目以**符号链接**指向它。

* 关闭功能 = 移除链接（内容留在 store，不丢失）
* 开启功能 = 建立链接
* 首次接管会把原始文件/链接移动到 `~/.omp-ctl/backup/`，可一键还原

## 安装

**Arch Linux（AUR）**

```sh
yay -S omp-ctl        # 或 paru -S omp-ctl
# 不想本地编译（Rust release + LTO，几分钟）就用预编译包：
yay -S omp-ctl-bin
```

包定义在 [`packaging/aur/`](packaging/aur/)：`omp-ctl` 从源码构建（依赖 `bun` + `cargo`），
`omp-ctl-bin` 直接展开 release 里的 `.deb`（只支持 `x86_64`）。两者 `provides`/`conflicts` 互斥，装其一。

**其它平台**：从 [Releases](https://github.com/moecly/omp-ctl/releases) 下载 deb / rpm / nsis / msi / dmg。

## 功能

**模型管理（`models.yml`）**
* 浏览 / 新建 / 编辑 / 删除 provider
* 编辑每个 provider 的模型列表
* 探测 provider 的 `/v1/models`（`probe_models`）
* 将任一模型设为默认（写入 `config.yml` 的 `modelRoles.default`）
* 编辑时保留原有注释与未建模字段，写前生成 `.bak.<时间戳>` 备份

**提示词开关（四个文件）**
开关通过链接是否存在实现，彼此独立：

| key | 文件 | 风险 |
| --- | --- | --- |
| `append_system` | `APPEND_SYSTEM.md` | 低 |
| `rules` | `RULES.md` | 中 |
| `agents` | `AGENTS.md` | 中 |
| `system` | `SYSTEM.md` | 高（替换默认系统提示词） |

每个文件都可编辑、可还原备份。对非托管条目（普通文件或外部 symlink，例如
home-manager 生成的 nix-store 链接）会先询问，确认后接管并不修改外部目标。

## 开发

```sh
nix develop          # 进入开发环境
just serve           # 终端 A：在 1420 端口提供 dist/ 静态文件
just dev             # 终端 B：启动 Tauri 窗口
just test            # 运行 Rust 测试
just build           # 构建 release 包
```

前端在 `web/`（React + TypeScript + Vite，`just web-build` 产出 `dist/`）。

## 发布

1. 升版本号，共四处但只有前两处要手改：
   * `src-tauri/Cargo.toml` 的 `version`
   * `src-tauri/tauri.conf.json` 的 `version`（决定 deb/rpm/msi 产物的版本号）
   * `Cargo.lock` —— 由 cargo 自己刷新，**必须一起提交**：AUR 构建用
     `cargo build --release --locked`，lock 里 `omp-ctl` 的旧版本号会让它直接失败
     （本地 `just build` 不带 `--locked`，会静默修好 lock，所以只有 AUR CI 会暴露）。
     `cargo check` 或任意不带 `--locked` 的 cargo 命令都会顺手刷新它。
   * `packaging/aur/*/PKGBUILD` 不用动：`publish.sh` 按 tag 重写 `pkgver`/`pkgrel`/`sha256sums`，
     发布成功后还会把改写结果**写回仓库**，所以仓库里的 PKGBUILD 永远等于 AUR 上的版本。
2. 打 tag 并推送：`git tag v0.6.0 && git push origin v0.6.0`。
   **tag 必须打在包含 `packaging/aur/` 最新内容的提交上**：`aur` job 用的是 tag 树里的
   包定义与 `publish.sh`，打在旧提交上会拿旧脚本发布（0.7.0 就这么丢过 `omp-ctl-bin`，
   而且发出的 `omp-ctl` 是缺 `custom-protocol` 的旧 PKGBUILD 编出来的）。
3. `release.yml` 的 `release` job 在三平台打包并建出 GitHub Release（deb / rpm / nsis+msi / app+dmg）。
4. 同一个 workflow 的 `aur` job（`needs: release`）在 Arch 容器里对
   `packaging/aur/` 下的每个包各跑一次 `publish.sh <tag> 1 <包名>`（matrix + `fail-fast: false`，
   一个包失败不影响另一个），把 PKGBUILD 与 .SRCINFO 推到 AUR。
   需要仓库 secret `AUR_SSH_KEY`（AUR 账户里登记的 ed25519 私钥，无口令）。
   不能拆成独立 workflow：release 由 `GITHUB_TOKEN` 创建，GitHub 不会用它触发新 workflow。

手动补发（本地，用 `~/.ssh/aur`，`AUR_KEY_FILE` 可改）：

```sh
packaging/aur/publish.sh v0.6.0              # 全部包，pkgrel=1
packaging/aur/publish.sh v0.6.0 2 omp-ctl    # 只发 omp-ctl，pkgrel=2（同版本重打包）
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

## 目录结构

```
~/.omp-ctl/
├── models.yml            # 托管后的真实文件
├── config.yml
├── SYSTEM.md  APPEND_SYSTEM.md  AGENTS.md  RULES.md
├── .links.json           # 托管记录（原目标、备份名）
└── backup/               # 接管前的原始条目
    └── models.yml.1790832129
```

`~/.omp/agent/` 中的对应条目为指向上述文件的 symlink。

## agent 目录解析顺序

1. `omp config path`
2. `PI_CODING_AGENT_DIR`
3. `OMP_PROFILE` / `PI_PROFILE`（跳过 `default`、`blank`）
4. `$XDG_DATA_HOME/omp/agent`（仅当目录存在）
5. `$HOME/.omp/agent`

## 写盘策略

* 所有写入先备份为 `<文件>.bak.<unix 时间戳>`
* 使用临时文件 + `rename` 原子替换
* YAML 采用行区间替换，只改动目标块
