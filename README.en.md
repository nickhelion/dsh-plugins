# DSH Plugins

English · [简体中文](README.md)

[![CI](https://github.com/nickhelion/dsh-plugins/actions/workflows/ci.yml/badge.svg)](https://github.com/nickhelion/dsh-plugins/actions/workflows/ci.yml)
[![Trusted Publishing](https://img.shields.io/badge/npm-Trusted%20Publishing%20%28OIDC%29-cb3837)](docs/RELEASING.md)
[![DSH plugins](https://img.shields.io/badge/DeepSeek%20Harness-plugins-4b32c3)](https://github.com/topics/dsh-plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A community-plugin monorepo for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). Packages retain independent npm names, versions, and `dsh.bundle` manifests while sharing development, CI, security, and tokenless release standards.

## Packages

| Package | Purpose | Install |
| --- | --- | --- |
| [`dsh-qwen-token-plan-cn-responses`](packages/qwen-token-plan-cn-responses) | Qwen Token Plan CN Personal Responses provider with official model/tool catalog sync. | `dsh plugin --profile web add dsh-qwen-token-plan-cn-responses` |
| [`dsh-serverchan-notify`](packages/serverchan-notify) | ServerChan3 WeChat notifications after each top-level Agent turn. | `dsh plugin --profile web add dsh-serverchan-notify` |

Each package installs independently. Installing one never silently enables the other.

### ServerChan notifications · `dsh-serverchan-notify`

`dsh-serverchan-notify` sends a WeChat notification through ServerChan3 (Server酱3) whenever a top-level DSH agent turn ends, whether it completed, failed, was blocked, or timed out. The message includes the conversation title, model, project directory, turn status, and a summary of the latest reply, so you can step away and still know when the run is done. Setup is deliberately small: install it with one command, add a SendKey, and apply a one-line patch. Delivery is fire-and-forget; a failed push writes one log entry and never blocks the agent loop. See [package docs](packages/serverchan-notify/README.md).

### Qwen Token Plan provider · `dsh-qwen-token-plan-cn-responses`

`dsh-qwen-token-plan-cn-responses` is a maintained DSH provider for the personal Qwen Token Plan, and it is also the one the maintainer uses every day. DSH's built-in provider, shown as "Qwen Token Plan 个人版（官方）" and inherited from Pi, uses Chat Completions, so official built-in tools such as web_search and code_interpreter cannot be triggered; its model catalog is manually maintained as well, and the context window and reasoning-effort metadata often drift from reality. This plugin uses the Responses API for native tool calling, syncs its model catalog with the official documentation every day, and records the actual context window and reasoning effort for each model. That also means models such as qwen3.8-max and deepseek-v4-pro can appear in the selector with accurate settings sooner.

<div align="center">
  <img src="docs/images/qwen-model-list.png" width="250" alt="Model list: per-model protocol and built-in tool annotations" />
</div>

See [package docs](packages/qwen-token-plan-cn-responses/README.md).

## Human quick start

```bash
git clone https://github.com/nickhelion/dsh-plugins.git
cd dsh-plugins
npm ci
npm run check
npm run pack:check
```

Read the package README for configuration. The root documents only shared policy.

## Agent quick start

1. Read [`AGENTS.md`](AGENTS.md).
2. Keep protocol behavior inside the target `packages/<name>` module.
3. Run `npm run check && npm run pack:check && npm run security:scan`.
4. Never read, print, or commit live credentials.
5. Release through the Tag → GitHub OIDC workflow in [`docs/RELEASING.md`](docs/RELEASING.md), never a long-lived npm publish token.

## Shared documentation

- [`AGENTS.md`](AGENTS.md) — repository map, invariants, and validation gates
- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) — workspace and test conventions
- [`docs/RELEASING.md`](docs/RELEASING.md) — one-time npm bootstrap and later Trusted Publishing
- [`docs/MONOREPO-MIGRATION.md`](docs/MONOREPO-MIGRATION.md) — compatibility and migration from standalone repositories
- [`SECURITY.md`](SECURITY.md) — credentials, supply chain, and vulnerability reporting

## License

Shared infrastructure is [MIT](LICENSE). Each package also carries its own license and applicable notice.
