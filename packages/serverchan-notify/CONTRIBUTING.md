# Contributing

Thanks for contributing! This is a small plugin; the full reference is in [`AGENTS.md`](AGENTS.md) — the two ground rules below are the non-negotiables.

## Ground rules

1. **No keys, no machine paths in the repo.** SendKeys flow through env vars, files, or plugin config only. Committed files must contain no real SendKey, no string that looks like one, and no absolute paths under a user home or checkout directory.
2. **The listener must never affect the harness.** The `session/event` listener stays synchronous, non-throwing, and fire-and-forget. A notification must never block or interrupt the agent loop.

## Development workflow

```bash
npm install        # devDependencies (cordis) for the smoke test
npm test           # in-process smoke test, fetch stubbed — no real push
REPORT=1 npm test  # smoke test + print the assembled payload
npm run test:live  # one real push using the configured SendKey
```

When a config option or behavior changes, update `lib/index.js` (the source of truth) and keep `README.md` and `README.zh-CN.md` in sync in the same PR.

## Releasing

Bump `version` in `package.json`, add a `CHANGELOG.md` entry, and tag the commit `v<version>` — CI runs `npm test` on every push and PR.
