<div align="center">

# 🔔 dsh-serverchan-notify

**A DeepSeek Harness (DSH) plugin that pushes a [Server酱3 (ServerChan³)](https://sct.ftqq.com/) notification to your WeChat every time an agent turn finishes an answer — codex Stop-hook parity for DSH.**

[English](README.md) · [简体中文](README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node ≥ 18](https://img.shields.io/badge/Node-%E2%89%A518-43853d.svg)](#requirements)
[![DSH plugin](https://img.shields.io/badge/DSH-plugin-4b32c3.svg)](https://github.com/topics/dsh-plugin)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

</div>

## What it does

- Subscribes to the DSH session event stream (`ctx.on("session/event", …)`).
- On every `turn/end` (`completed` / `error` / `blocked` / `max-tokens` / `aborted`), pushes one Markdown notification to Server酱3 → your WeChat.
- Each notification carries: conversation title, model, project directory, git branch, turn status, finish time, session id, and the latest reply excerpt (truncated at 16 000 chars).
- **Fire-and-forget**: a failed push only logs a warning and never blocks or interrupts the agent loop.
- Skips subagent sessions by default (no spam from internal subtasks).

| | codex Stop hook | this plugin |
| --- | --- | --- |
| Trigger | one per finished turn | one per finished turn (`turn/end`) |
| Key source | env / `~/.codex/secrets/…` | env / config / `$DSH_HOME/secrets/…` (see [SendKey resolution](#sendkey-resolution)) |
| Failure handling | never blocks the turn | never blocks the turn |
| Scope | global `hooks.json` | global `$DSH_HOME/cordis.patch.yml` (or per profile) |

> 🔐 **This repository contains no SendKey.** Keys come from the environment, a file, or plugin config — never from source code.

## Requirements

- DeepSeek Harness (DSH) with `@deepseek-ai/cordis` ^4.0.1
- Node.js ≥ 18
- A Server酱3 SendKey (free account at <https://sct.ftqq.com/>)

## Quick start

### 1. Get a SendKey

Log in at <https://sct.ftqq.com/>, open the **SendKey** tab, and copy your key — it looks like `sctp<number>txxxx…`. The plugin auto-derives your dedicated push domain (`https://<number>.push.ft07.com/send/<key>.send`); legacy keys without a channel number use `https://sctapi.ftqq.com/<key>.send`.

### 2. Save the key (recommended)

```bash
mkdir -p ~/.dsh/secrets
echo '你的SendKey' > ~/.dsh/secrets/serverchan_sendkey
chmod 600 ~/.dsh/secrets/serverchan_sendkey
```

### 3. Register the plugin

Edit your DSH patch layer and restart the harness:

```yaml
# global — all profiles (like codex's global hooks.json):
#   $DSH_HOME/cordis.patch.yml   (default ~/.dsh/cordis.patch.yml)
# per profile:
#   $DSH_HOME/profiles/<name>/cordis.patch.yml

- insert:
    - id: serverchan-notify
      name: 'dsh-serverchan-notify'
      config:
        sendkeyFile: '~/.dsh/secrets/serverchan_sendkey'
```

Plugin rows are only resolved at boot — **restart the harness process** after editing.

## Installing the package

The package declares a `dsh.bundle` manifest, so it installs with one command (from GitHub until it is on npm):

```bash
# install into a profile (github spec — works without an npm publish)
dsh plugin --profile web add github:nickhelion/dsh-serverchan-notify

# npm (once published)
cd ~/.dsh/profiles && pnpm add dsh-serverchan-notify

# manual: clone + symlink into the profile's module tree
git clone https://github.com/nickhelion/dsh-serverchan-notify
ln -s "$(pwd)/dsh-serverchan-notify" ~/.dsh/profiles/node_modules/dsh-serverchan-notify
```

The bundled `cordis.patch.yml` inserts the plugin row with all-default config; override any option by addressing the row id `serverchan-notify` from your own patch layer.

## SendKey resolution

The first non-empty value wins, in this order:

| # | Source | Example |
| --- | --- | --- |
| 1 | env var `SERVERCHAN_SENDKEY` | `export SERVERCHAN_SENDKEY=sctp…` |
| 2 | inline config `sendkey` | `config.sendkey: 'sctp…'` |
| 3 | env var `SERVERCHAN_SENDKEY_FILE` (path to a key file) | `export SERVERCHAN_SENDKEY_FILE=…` |
| 4 | config `sendkeyFile` (supports `~`) | `config.sendkeyFile: '~/.dsh/secrets/…'` |
| 5 | default file `$DSH_HOME/secrets/serverchan_sendkey` | `~/.dsh/secrets/serverchan_sendkey` |

## Configuration

| Key | Default | Description |
| --- | --- | --- |
| `sendkey` | — | Inline key (overridden by the `SERVERCHAN_SENDKEY` env var) |
| `sendkeyFile` | `$DSH_HOME/secrets/serverchan_sendkey` | Path to a key file; `~` is expanded |
| `reasons` | `[completed, blocked, error, max-tokens, aborted]` | Which `turn/end` reasons trigger a push (`interrupted` is never pushed) |
| `notifySubagents` | `false` | Also push subagent sessions (off by default to avoid spam) |
| `timeoutMs` | `8000` | HTTP timeout in milliseconds |
| `maxResponseChars` | `16000` | Reply excerpt truncation length |
| `disabled` | `false` | Disable without removing the row (no key read, no subscription) |

## Sample notification

> **DSH 完成：<conversation title>**
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
> …the latest assistant reply…

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "未找到 Server酱 SendKey" warning at boot | Provide the key via one of the 5 sources above |
| `HTTP 403` / timeout in the log | Network / proxy issue; the push domain is derived from the key (`<n>.push.ft07.com`) |
| No push after restart | Confirm the row id is unique and the package resolves — `dsh --profile web --dump-config \| grep -A8 serverchan-notify` |
| Too many pushes | Turn on `notifySubagents: false` (default) or trim `reasons` |
| Temporarily stop | `disabled: true`, then restart |

## Development

```bash
npm install        # installs devDependencies (cordis) for the smoke test
npm test           # smoke test — stubbed fetch, no real push
REPORT=1 npm test  # smoke test + print the assembled payload
npm run test:live  # send one real test push with the configured key
```

## Repository layout

```
lib/index.js      plugin entry — event subscription, message assembly, HTTP push
test-send.mjs     standalone real push (same key resolution order as the plugin)
smoke-test.mjs    cordis in-process test with a stubbed fetch
package.json      package metadata + npm scripts
README.md         English docs
README.zh-CN.md   中文文档
```

## Contributing

PRs welcome. Two ground rules:

1. **Never commit a SendKey** (or any absolute machine path) — keys flow through env / file / config only.
2. The event listener must stay **non-throwing and fire-and-forget** — a notification must never affect the harness.

## License

[MIT](LICENSE)
