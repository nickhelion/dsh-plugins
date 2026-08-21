# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-08-21

### Changed

- Moved the canonical source into the `nickhelion/dsh-plugins` monorepo without changing the npm name or DSH entry id.
- Added npm-first installation, shared CI/package audit, and OIDC Trusted Publishing documentation.

## [1.0.0] - 2026-08-18

### Added

- Initial release: push a ServerChan3 (Server酱) notification to WeChat whenever a DeepSeek Harness turn finishes (`turn/end`).
- Notification payload: conversation title, model, project directory, git branch, turn status, finish time, session id, and a reply excerpt (truncated at 16 000 chars).
- SendKey resolution from five sources: `SERVERCHAN_SENDKEY`, inline `config.sendkey`, `SERVERCHAN_SENDKEY_FILE`, `config.sendkeyFile`, and the default `$DSH_HOME/secrets/serverchan_sendkey` file.
- Auto-derived ServerChan3 push domain (`sctp<N>t…` keys → `https://<N>.push.ft07.com`; legacy keys → `sctapi.ftqq.com`).
- Fire-and-forget delivery — a failed push logs a warning and never affects the harness loop.
- Subagent sessions skipped by default (`notifySubagents: false`).
- `dsh.bundle` manifest so the plugin installs via `dsh plugin add`.
- Bilingual documentation (English / 简体中文), `AGENTS.md`, smoke test, and a live-push test script.

[1.0.1]: https://github.com/nickhelion/dsh-plugins/releases/tag/serverchan-notify-v1.0.1
[1.0.0]: https://github.com/nickhelion/dsh-serverchan-notify/releases/tag/v1.0.0
