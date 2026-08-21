# AGENTS.md — ServerChan package

The repository-root `AGENTS.md` and release/security rules also apply. This file adds package-specific runtime invariants.

dsh-serverchan-notify — a DeepSeek Harness (DSH) cordis plugin that pushes a Server酱3 notification to WeChat whenever a top-level agent turn ends. Working on this repo: edit `lib/index.js`, verify with `npm test`, and use `npm run test:live` only for a manual end-to-end push.

## Invariants

These rules are load-bearing; do not "improve" them away:

1. **No keys, no machine paths in the repo.** SendKeys and absolute paths flow through env vars, files, or plugin config only (`lib/index.js` → `loadSendkey`). Committed files must contain no real SendKey and no absolute paths under a user home or checkout directory. Exception: obviously-fake well-formed keys are allowed in test files to cover the URL-derivation branches — they must be loudly marked (contain `FAKE`, `TEST`, or `NOT-REAL`) and never look like a real key.
2. **The listener must never affect the harness.** The `session/event` listener is synchronous: it only reads and schedules `deliver` (`void deliver(...)`). `deliver` catches everything and reports via `ctx.logger.warn`. Keep it that way — a throwing listener or a blocking push breaks the agent loop.
3. **One push per finished top-level turn.** Trigger on `turn/end` only; skip subagent sessions unless `notifySubagents: true`. `interrupted` turns are never pushed.

## Where things are

| File | Role |
| --- | --- |
| `lib/index.js` | Plugin entry (default export `(ctx, config) => void`). Single source of truth for config semantics and SendKey resolution order. |
| `cordis.patch.yml` | The bundle patch inserted by `dsh plugin add` — minimal row (`serverchan-notify`), all-default config. |
| `smoke-test.mjs` | In-process test: real cordis `Context`, fake session, stubbed `fetch`. Run with `npm test`; `REPORT=1` prints the payload. |
| `test-send.mjs` | Real push using the same key resolution order. |
| `README.md` / `README.zh-CN.md` | Human docs (English / 中文). Keep both in sync for every config change. |

## Config semantics (source of truth: `lib/index.js`)

- SendKey precedence: `SERVERCHAN_SENDKEY` → `config.sendkey` → `SERVERCHAN_SENDKEY_FILE` → `config.sendkeyFile` → `$DSH_HOME/secrets/serverchan_sendkey`.
- Push URL: keys matching `/^sctp(\d+)t/` use `https://<n>.push.ft07.com/send/<key>.send`; others use `https://sctapi.ftqq.com/<key>.send`.

## Deploying a change on a live machine

1. From the monorepo root, `npm test --workspace dsh-serverchan-notify` passes.
2. Restart the harness process so the loader re-reads the profile patch layer (a running DSH does not hot-load new plugin rows).

## Useful check

Profile composition sanity (does not boot a server):

```bash
dsh --profile web --dump-config | grep -A8 serverchan-notify
```
