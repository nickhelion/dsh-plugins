<div align="center">

# 🔔 dsh-serverchan-notify

**DeepSeek Harness (DSH) 插件：每当一个回答回合结束，就向 [Server酱3 (ServerChan³)](https://sct.ftqq.com/) 推送一条通知到你的微信——对齐 codex Stop hook 的行为。**

[English](README.md) · [简体中文](README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node ≥ 18](https://img.shields.io/badge/Node-%E2%89%A518-43853d.svg)](#环境要求)
[![npm version](https://img.shields.io/npm/v/dsh-serverchan-notify.svg)](https://www.npmjs.com/package/dsh-serverchan-notify)
[![CI](https://github.com/nickhelion/dsh-plugins/actions/workflows/ci.yml/badge.svg)](https://github.com/nickhelion/dsh-plugins/actions/workflows/ci.yml)
[![DSH plugin](https://img.shields.io/badge/DSH-plugin-4b32c3.svg)](https://github.com/topics/dsh-plugin)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#参与贡献)

</div>

## 功能

- 订阅 DSH 会话事件流（`ctx.on("session/event", …)`）。
- 每个回答回合结束（`turn/end`，无论 `completed` / `error` / `blocked` / `max-tokens` / `aborted`）推送一条 Markdown 通知到 Server酱3 → 你的微信。
- 通知内容：对话标题、模型、项目目录、Git 分支、回合状态、完成时间、会话 ID，以及最新一段回复正文（超过 16000 字符自动截断）。
- **fire-and-forget**：推送失败只记一条警告日志，绝不阻塞或中断 agent 主循环。
- 默认跳过子代理会话，避免被内部子任务刷屏。

| | codex Stop hook | 本插件 |
| --- | --- | --- |
| 触发时机 | 每个回合结束一次 | 每个回合结束一次（`turn/end`） |
| key 来源 | 环境变量 / `~/.codex/secrets/…` | 环境变量 / 配置 / `$DSH_HOME/secrets/…`（见 [SendKey 解析顺序](#sendkey-解析顺序)） |
| 失败处理 | 绝不影响回合 | 绝不影响回合 |
| 作用域 | 全局 `hooks.json` | 全局 `$DSH_HOME/cordis.patch.yml`（或单 profile） |

> 🔐 **本仓库不含任何 SendKey。** key 一律来自环境变量、文件或插件配置，绝不写入源码。

## 环境要求

- DeepSeek Harness (DSH)，`@deepseek-ai/cordis` ^4.0.1
- Node.js ≥ 18
- 一个 Server酱3 SendKey（<https://sct.ftqq.com/> 免费注册）

## 快速开始

### 1. 获取 SendKey

登录 <https://sct.ftqq.com/>，打开「SendKey」页签复制你的 key，形如 `sctp<数字>txxxx…`。插件会自动推导专属推送域名（`https://<数字>.push.ft07.com/send/<key>.send`）；不带通道号的旧式 key 则使用通用域名 `https://sctapi.ftqq.com/<key>.send`。

### 2. 保存 key（推荐）

```bash
mkdir -p ~/.dsh/secrets
echo '你的SendKey' > ~/.dsh/secrets/serverchan_sendkey
chmod 600 ~/.dsh/secrets/serverchan_sendkey
```

### 3. 挂载插件

编辑 DSH 的补丁层并重启 harness：

```yaml
# 全局（所有 profile 生效，等价于 codex 的全局 hooks.json）：
#   $DSH_HOME/cordis.patch.yml   （默认 ~/.dsh/cordis.patch.yml）
# 单 profile：
#   $DSH_HOME/profiles/<name>/cordis.patch.yml

- insert:
    - id: serverchan-notify
      name: 'dsh-serverchan-notify'
      config:
        sendkeyFile: '~/.dsh/secrets/serverchan_sendkey'
```

插件行只在启动时解析——改完配置后**必须重启 harness 进程**。

## 安装插件包

本包声明了 `dsh.bundle` manifest，通过 npm 一条命令安装：

```bash
# 推荐
dsh plugin --profile web add dsh-serverchan-notify

# 固定版本
dsh plugin --profile web add dsh-serverchan-notify@1.0.2

# GitHub monorepo 回退
dsh plugin --profile web add 'github:nickhelion/dsh-plugins#main&path:/packages/serverchan-notify'

# 本地开发
git clone https://github.com/nickhelion/dsh-plugins.git
dsh plugin --profile web add "$PWD/dsh-plugins/packages/serverchan-notify"
```

包内自带的 `cordis.patch.yml` 以全默认配置插入插件行；如需覆盖某个选项，在自己的补丁层里按行 id `serverchan-notify` 重写即可。

## SendKey 解析顺序

取第一个非空值，优先级从高到低：

| # | 来源 | 示例 |
| --- | --- | --- |
| 1 | 环境变量 `SERVERCHAN_SENDKEY` | `export SERVERCHAN_SENDKEY=sctp…` |
| 2 | 配置内联 `sendkey` | `config.sendkey: 'sctp…'` |
| 3 | 环境变量 `SERVERCHAN_SENDKEY_FILE`（指向 key 文件） | `export SERVERCHAN_SENDKEY_FILE=…` |
| 4 | 配置 `sendkeyFile`（支持 `~`） | `config.sendkeyFile: '~/.dsh/secrets/…'` |
| 5 | 默认文件 `$DSH_HOME/secrets/serverchan_sendkey` | `~/.dsh/secrets/serverchan_sendkey` |

## 配置项

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `sendkey` | — | 内联明文 key（优先级低于 `SERVERCHAN_SENDKEY` 环境变量） |
| `sendkeyFile` | `$DSH_HOME/secrets/serverchan_sendkey` | key 文件路径，支持 `~` 开头 |
| `reasons` | `[completed, blocked, error, max-tokens, aborted]` | 哪些 `turn/end` 原因触发推送（`interrupted` 恒不推） |
| `notifySubagents` | `false` | 是否也给子代理会话推送（默认关，防刷屏） |
| `timeoutMs` | `8000` | HTTP 超时（毫秒） |
| `maxResponseChars` | `16000` | 回复正文截断长度 |
| `disabled` | `false` | 临时禁用（不读 key、不订阅事件） |

## 通知示例

> **DSH 完成：<对话标题>**
>
> - **对话标题**：…
> - **模型**：deepseek-official / deepseek-v4-pro
> - **项目目录**：`/home/you/project`
> - **Git 分支**：`main`
> - **回合状态**：完成
> - **完成时间**：2026-08-18T21:00:00.000Z
> - **会话 ID**：`session-12`
>
> ## DSH 最新回复
>
> ……最新一段模型回复……

## 常见问题

| 现象 | 处理 |
| --- | --- |
| 启动日志出现「未找到 Server酱 SendKey」 | 按上面 5 种来源之一提供 key |
| 日志出现 `HTTP 403` / 超时 | 网络或代理问题；推送域名由 key 推导（`<n>.push.ft07.com`） |
| 重启后仍收不到 | 确认行 id 唯一且包可解析——`dsh --profile web --dump-config \| grep -A8 serverchan-notify` |
| 推送太频繁 | 保持 `notifySubagents: false`（默认）或裁剪 `reasons` |
| 想临时停用 | `disabled: true`，重启生效 |

## 开发

```bash
npm install        # 安装 devDependencies（cordis），供冒烟测试使用
npm test           # 冒烟测试——fetch 打桩，不真实推送
REPORT=1 npm test  # 冒烟测试 + 打印组装好的报文
npm run test:live  # 按配置的 key 真实推送一条测试通知
```

## 仓库结构

```
lib/index.js      插件入口——事件订阅、报文组装、HTTP 推送
test-send.mjs     独立真实推送脚本（key 解析顺序与插件一致）
smoke-test.mjs    cordis 进程内冒烟测试（fetch 打桩）
package.json      包元数据 + npm scripts
README.md         英文文档
README.zh-CN.md   中文文档
```

## 参与贡献

请向统一的 [`nickhelion/dsh-plugins`](https://github.com/nickhelion/dsh-plugins) monorepo 提交 PR。两条底线规则：

1. **绝不提交 SendKey**（或任何机器绝对路径）——key 只能经环境变量 / 文件 / 配置进入。
2. 事件监听器必须保持**不抛异常、fire-and-forget**——通知绝不能影响 harness 主流程。

## License

[MIT](LICENSE)
