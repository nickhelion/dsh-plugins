# Changelog

All notable changes to this project are documented here. The format follows Keep a Changelog and versions follow Semantic Versioning.

## [Unreleased]

## [0.1.4] - 2026-08-21

### Fixed

- Expose the official `low` / `high` / `max` reasoning-effort controls for `deepseek-v4-pro-0813` and `deepseek-v4-flash-0731`, plus `high` / `max` for current DeepSeek V4 and GLM models.
- Derive Responses reasoning profiles from the official API reference instead of misusing OpenClaw's unrelated `reasoning` boolean.

## [0.1.3] - 2026-08-21

### Security

- Switched routine npm releases to GitHub OIDC Trusted Publishing with provenance and disabled traditional token publishing.

## [0.1.2] - 2026-08-21

### Changed

- Moved the canonical source into the `nickhelion/dsh-plugins` monorepo without changing the npm name or DSH provider id.
- Added shared CI, package-content auditing, and npm Trusted Publishing documentation.

## [0.1.1] - 2026-08-20

### Added

- npm-ready package contents, npm installation/upgrade/removal instructions and discoverability badges.
- Agent, architecture, catalog-sync, contribution and security documents inside the published tarball.

## [0.1.0] - 2026-08-20

### Added

- Dedicated DeepSeek Harness LLM Adapter for Qwen Token Plan CN Responses API.
- Official Markdown catalog synchronization with conditional requests and last-known-good cache.
- Explicit per-model server-side Harness tool descriptions in the DSH selector.
- DSH local function calls, durable image input and tool-result replay.
- Responses SSE mapping for text, reasoning, functions, usage, failures and provider-side tool activity.
- Network-free tests plus an optional live catalog check.

[Unreleased]: https://github.com/nickhelion/dsh-plugins/compare/qwen-token-plan-cn-responses-v0.1.4...HEAD
[0.1.4]: https://github.com/nickhelion/dsh-plugins/releases/tag/qwen-token-plan-cn-responses-v0.1.4
[0.1.3]: https://github.com/nickhelion/dsh-plugins/releases/tag/qwen-token-plan-cn-responses-v0.1.3
[0.1.2]: https://github.com/nickhelion/dsh-plugins/releases/tag/qwen-token-plan-cn-responses-v0.1.2
[0.1.1]: https://github.com/nickhelion/dsh-plugins/releases/tag/qwen-token-plan-cn-responses-v0.1.1
[0.1.0]: https://github.com/nickhelion/dsh-plugins/releases/tag/v0.1.0
