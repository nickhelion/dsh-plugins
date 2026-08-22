# 投稿 / 收录记录（Submissions & Listings)

Tracks where the two `nickhelion` DSH plugins are submitted and listed upstream.
Owner: `nickhelion`. Live home for both plugins: the monorepo
[`nickhelion/dsh-plugins`](https://github.com/nickhelion/dsh-plugins) — package
`packages/qwen-token-plan-cn-responses` and `packages/serverchan-notify`.

> Principle: every list that hosts “one of ours” should host **both** plugins,
> and every entry should point at the live monorepo subpackage, never at the
> archived standalone repos.

## The two plugins

| Package | Monorepo path | Install |
| --- | --- | --- |
| `dsh-qwen-token-plan-cn-responses` | `packages/qwen-token-plan-cn-responses` | `dsh plugin add dsh-qwen-token-plan-cn-responses` |
| `dsh-serverchan-notify` | `packages/serverchan-notify` | `dsh plugin add dsh-serverchan-notify` |

## Listing status (checked 2026-08-22)

| Upstream list | Qwen | ServerChan | Pointing to live monorepo? | Notes |
| --- | --- | --- | --- | --- |
| `awesome-dsh-plugin/awesome-dsh-plugin` | ❌ pending | ✅ listed | Qwen: not yet; ServerChan: **no** (archived standalone) | PR [#2682](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/2682) adds Qwen + repoints ServerChan → monorepo. **OPEN**, submission gate passed, awaiting human merge. |
| `Dominic789654/awesome-deepseek-harness` | ✅ | ✅ | ✅ both hrefs → monorepo | Already has both; link text still old standalone names. **Left untouched** by decision. |
| `vvlife/awesome-deepseek-harness-plugins` | ✅ | ✅ | ✅ both hrefs → monorepo | ServerChan added via PR [#115](https://github.com/vvlife/awesome-deepseek-harness-plugins/pull/115), **merged 2026-08-22** (auto-merge). |

## Per-list history

### `awesome-dsh-plugin/awesome-dsh-plugin`
- Earlier: `nickhelion/dsh-serverchan-notify` listed (entry `data/plugins/nickhelion__dsh-serverchan-notify.yml`) pointing to the now-**archived** standalone repo.
- 2026-08-22 — PR [#2682](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/2682) (branch `nickhelion-monorepo-update`):
  - add `data/plugins/nickhelion__dsh-plugins--packages-qwen-token-plan-cn-responses.yml` (category `model` → Models & Providers);
  - rename/update ServerChan entry to `data/plugins/nickhelion__dsh-plugins--packages-serverchan-notify.yml` → monorepo subpackage;
  - both READMEs regenerated via `scripts/generate-readme.mjs`.
  - Submission gate: **pass** (“Entries look good”). Awaiting maintainer merge.

### `Dominic789654/awesome-deepseek-harness`
- Both plugins present (Qwen + ServerChan), both `href`s already point to monorepo subpackages.
- Link text still uses legacy names (`nickhelion/dsh-qwen-token-plan-cn-responses`,
  `nickhelion/dsh-serverchan-notify`). Not modified (per decision); its contributing rule forbids editing existing lines.

### `vvlife/awesome-deepseek-harness-plugins`
- Before: only Qwen listed.
- 2026-08-22 — PR [#115](https://github.com/vvlife/awesome-deepseek-harness-plugins/pull/115) adds ServerChan
  under **Integrations & Bridges**, right after the Qwen entry; href → monorepo subpackage.
  Auto-reviewed (`review_pr.py`): R1 only README.md, R2–R4 0 new repo (same monorepo repo as Qwen already listed)
  → **AUTO-APPROVED, merged** by github-actions.

## Maintenance rules the author follows
- Only edit one's own entries in any upstream list; never rewrite a neighbour.
- Always point at the live monorepo subpackage, never the archived standalone repos.
- Descriptions state only what the code does (no marketing); keep EN + ZH consistent.
- When lists are generated (e.g. awesome-dsh-plugin), edit the `data/plugins/*.yml`
  and regenerate READMEs — never hand-edit the generated files.
