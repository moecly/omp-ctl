# omp-ctl

用于管理 [omp](https://omp.sh) 配置的桌面 GUI（Tauri 2）。

核心设计：`~/.omp-ctl/` 是唯一真实来源（single source of truth），
`~/.omp/agent/` 下的条目以**符号链接**指向它。

* 关闭功能 = 移除链接（内容留在 store，不丢失）
* 开启功能 = 建立链接
* 首次接管会把原始文件/链接移动到 `~/.omp-ctl/backup/`，可一键还原

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

前端是无构建步骤的静态文件（`dist/index.html`、`style.css`、`app.js`），
通过 `withGlobalTauri` 调用后端命令。

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
