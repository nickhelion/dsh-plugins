# AGENTS.md — ServerChan package

The repository-root `AGENTS.md` and release/security rules also apply. This file adds package-specific runtime invariants.

dsh-serverchan-notify — a DeepSeek Harness (DSH) cordis plugin that pushes a Server酱3 notification to WeChat when a top-level agent turn ends, and when the agent calls `ask_user_question` and blocks waiting for a human. Working on this repo: edit `lib/index.js`, verify with `npm test`, and use `npm run test:live` only for a manual end-to-end push.

## Invariants

These rules are load-bearing; do not "improve" them away:

1. **No keys, no machine paths in the repo.** SendKeys and absolute paths flow through env vars, files, or plugin config only (`lib/index.js` → `loadSendkey`). Committed files must contain no real SendKey and no absolute paths under a user home or checkout directory. Exception: obviously-fake well-formed keys are allowed in test files to cover the URL-derivation branches — they must be loudly marked (contain `FAKE`, `TEST`, or `NOT-REAL`) and never look like a real key.
2. **The listener must never affect the harness.** The `session/event` listener is synchronous: it only reads and schedules `deliver` / `deliverQuestion` (`void deliver(...)`). Both catch everything and report via `ctx.logger.warn`. Keep it that way — a throwing listener or a blocking push breaks the agent loop. Web lookups, socket calls, and git access live inside the scheduled async delivery, never in the listener.
3. **Two sanctioned triggers, one push each.** Push on `turn/end` (skipped for `interrupted`) and on a `tool/call` of `ask_user_question` (`notifyQuestions: false` disables the latter). Do not add a third trigger without changing this invariant, and never send more than one push per triggering event. Subagent sessions (`header.delegationDepth > 0`) are skipped unless `notifySubagents: true`.

## Where things are

| File | Role |
| --- | --- |
| `lib/index.js` | Plugin entry (default export `(ctx, config) => void`). Single source of truth for config semantics and SendKey resolution order. |
| `lib/index.d.ts` | Hand-written types for the config surface. Keep in sync with `options` in `lib/index.js`. |
| `cordis.patch.yml` | The bundle patch inserted by `dsh plugin add` — minimal row (`serverchan-notify`), all-default config. |
| `smoke-test.mjs` | In-process test: real cordis `Context`, fake session, stubbed `fetch`. Run with `npm test`; `REPORT=1` prints the payload. |
| `test-send.mjs` | Real push using the same key resolution order. |
| `README.md` / `README.zh-CN.md` | Human docs (English / 中文). Keep both in sync for every config change. |

## Config semantics (source of truth: `lib/index.js`)

- SendKey precedence: `SERVERCHAN_SENDKEY` → `config.sendkey` → `SERVERCHAN_SENDKEY_FILE` → `config.sendkeyFile` → `$DSH_HOME/secrets/serverchan_sendkey`.
- Push URL: keys matching `/^sctp(\d+)t/` use `https://<n>.push.ft07.com/send/<key>.send`; others use `https://sctapi.ftqq.com/<key>.send`.
- Question reminders key off the literal tool name `ask_user_question` (`QUESTION_TOOL_NAME`), the model-facing tool registered by `@deepseek-ai/dsh-tool-ask-user`. Its `tool/call` event carries the model's raw, unparsed `arguments` JSON string, so parsing is defensive: malformed arguments degrade the push body and never throw.

## Session log access — two Harness API lines

Reading the session log goes through the single `sessionEvents(session)` helper in `lib/index.js`. Do not read a session field directly anywhere else.

- Harness `0.1.2-rc.1` **removed** the `Session.events` getter; it exposes `snapshotEvents()` and `ownEvents()`.
- Harness `0.1.0-rc.x` / `0.1.1-rc.x` expose only `events`.

The helper prefers `snapshotEvents()` and falls back to `events`. Reading an accessor the running Harness does not have yields `undefined`, which throws inside the fire-and-forget `deliver` and is swallowed into a `logger.warn` — the plugin then stops notifying **with no visible error**. That is exactly the 1.0.2 failure; see the CHANGELOG. `smoke-test.mjs` guards it by testing a legacy-shaped session and a modern one that deliberately has no `events` property.

## Deploying a change on a live machine

1. From the monorepo root, `npm test --workspace dsh-serverchan-notify` passes.
2. Restart the harness process so the loader re-reads the profile patch layer (a running DSH does not hot-load new plugin rows).

## Useful check

Profile composition sanity (does not boot a server):

```bash
dsh --profile web --dump-config | grep -A8 serverchan-notify
```
