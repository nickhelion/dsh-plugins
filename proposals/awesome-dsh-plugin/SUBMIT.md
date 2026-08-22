# Submit Qwen plugin to awesome-dsh-plugin

> **Status (2026-08-22):** submitted as PR
> [`#2682`](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/2682)
> (branch `nickhelion-monorepo-update`). Submission gate passed; awaiting
> maintainer merge. This file documents the change for reference.

Target upstream: [`awesome-dsh-plugin/awesome-dsh-plugin`](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
Per upstream [`contributing.md`](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md): **READMEs are generated — do not hand-edit.** One YAML file per plugin.

## The file to add

`data/plugins/nickhelion__dsh-plugins--packages-qwen-token-plan-cn-responses.yml`
(local draft copy: `proposals/awesome-dsh-plugin/nickhelion__dsh-plugins--packages-qwen-token-plan-cn-responses.yml`)

```yaml
url: https://github.com/nickhelion/dsh-plugins/tree/main/packages/qwen-token-plan-cn-responses
name: nickhelion/dsh-plugins#qwen-token-plan-cn-responses
category: model
description:
  en: Qwen Token Plan adapter for DeepSeek Harness via the OpenAI Responses API, with Qwen server-side tools, DSH local function tools, persistence of text/reasoning/tool-call images, and a per-release versioned model catalog.
  zh: 面向 DeepSeek Harness 的千问 Token Plan 适配器，走 OpenAI Responses API，支持 Qwen 服务端工具、DSH 本地函数工具、多轮文本/推理/工具调用与图片附件持久化，模型目录随 npm 版本发布。
```

## Steps

1. Fork / clone `awesome-dsh-plugin/awesome-dsh-plugin`.
2. Add the YAML above as `data/plugins/<filename>.yml`.
3. Regenerate the two READMEs: `npm ci && node scripts/generate-readme.mjs`.
4. Commit the YAML **and** the regenerated `README.md` + `README.zh.md` together (one file-PR; don't touch any other entry).
5. Push and open a PR titled e.g. `Add nickhelion/dsh-plugins#qwen-token-plan-cn-responses (model)`.

## Requirements already met (verified 2026-08-22)
- Declares `dsh.bundle` manifest ✓ (`packages/qwen-token-plan-cn-responses/package.json` → `cordis.patch.yml`)
- Real working code + tests ✓
- Repo `nickhelion/dsh-plugins`: 48 commits, created 2026-08 (≥1 day, ≥10 commits) ✓
- `dsh-plugin` topic set on `nickhelion/dsh-plugins` ✓ (also on `nickhelion/dsh-serverchan-notify`)
- Official `@deepseek-ai/*` declared as `peerDependencies` (not `dependencies`) ✓
- Description is accurate to the README → no overstating (review cross-checks against code)

## Notes / caveats
- This plugin is **already listed** in two other awesome lists:
  - `Dominic789654/awesome-deepseek-harness` (PR #206, #218 merged)
  - `vvlife/awesome-deepseek-harness-plugins` (PR #111, #114 merged)
- The other two lists still link the archived standalone repo `nickhelion/dsh-serverchan-notify` /
  `nickhelion/dsh-qwen-token-plan-cn-responses` (now the monorepo). Not required to fix here, but worth a
  follow-up so published links stay live.
