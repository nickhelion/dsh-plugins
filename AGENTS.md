# Agent Guide — dsh-plugins

This file governs the entire repository. A package-local `AGENTS.md` may add stricter rules for that package but may not weaken these rules.

## Mission

Maintain independently installable DeepSeek Harness plugins behind deep, narrow modules. Shared repository infrastructure owns development, security, package validation, and releases; package directories own runtime behavior and user configuration.

## Agent skills

### Issue tracker

Issues, specs, and Wayfinder maps live in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the repository's five canonical triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

This repository uses a multi-context domain-doc layout. See `docs/agents/domain.md`.

## Repository map

| Path | Responsibility |
| --- | --- |
| `packages/qwen-token-plan-cn-responses` | Qwen Token Plan Responses LLM Adapter and official-document catalog sync. |
| `packages/serverchan-notify` | Non-blocking ServerChan3 turn-end notification plugin. |
| `scripts/run-workspaces.mjs` | Runs package scripts without assuming a globally installed `npm` binary. |
| `scripts/check-packages.mjs` | Audits npm tarball contents for every public workspace. |
| `scripts/release.mjs` | Prepares a package-specific version commit and Tag; optionally pushes them. |
| `.github/workflows/ci.yml` | Deterministic tests and pack audit. |
| `.github/workflows/publish.yml` | npm Trusted Publishing through GitHub OIDC; no `NPM_TOKEN`. |
| `docs/RELEASING.md` | Human/Agent release contract. |

## Required commands

```bash
npm ci
npm run check
npm run pack:check
npm run security:scan
```

Package-focused work may use:

```bash
npm run check --workspace dsh-qwen-token-plan-cn-responses
npm test --workspace dsh-serverchan-notify
```

## Global invariants

1. **No secrets.** Never commit or log API keys, SendKeys, npm tokens, OTPs, cookies, credential files, local session logs, or private filesystem paths. Run `npm run security:scan` before publication; it checks known local credentials against current files and the full Git history without printing them.
2. **No long-lived npm publish token.** Do not create or restore an Automation/GAT wizard. Initial package bootstrap is interactive with 2FA; every later publish uses GitHub Actions Trusted Publishing (OIDC).
   Current npm bootstrap uses the human's browser Passkey as documented in `docs/RELEASING.md`; an Agent must never request a password, recovery code, or exported Passkey in chat.
3. **One package, one version, one Tag prefix.** Qwen tags are `qwen-token-plan-cn-responses-vX.Y.Z`; ServerChan tags are `serverchan-notify-vX.Y.Z`.
4. **Package independence.** A package may not import runtime code from another workspace unless that dependency is explicitly declared and there is a real interface reason. Installing one package must not activate another.
5. **Official DSH packages remain peers.** Do not bundle a second Harness/Cordis runtime into production dependencies.
6. **No install lifecycle scripts.** These plugins ship runnable JavaScript. Keep installation compatible with npm v12's scripts-off default. Release-time `prepack` checks are allowed; `preinstall`/`install`/`postinstall` are not.
7. **Tag publication is reproducible.** `publish.yml` checks Tag/version equality, installs with scripts disabled, runs tests, audits the pack list, then publishes from a GitHub-hosted runner.
8. **Do not hand-edit generated external Awesome lists.** Follow each upstream's contribution format and only claim behavior proven by code/tests.
9. **Qwen catalog changes are build-time, not runtime.** The installed plugin reads a release-bundled snapshot and must never poll official documentation. `catalog-sync.yml` may open a reviewed patch-release PR; merging that PR is the publication approval.

## Package boundaries

### Qwen provider

Read `packages/qwen-token-plan-cn-responses/AGENTS.md`. Preserve its catalog fail-closed behavior, distinction between Qwen server-side tools and DSH local functions, and exact Responses tool semantics.

### ServerChan notifier

Read `packages/serverchan-notify/AGENTS.md`. Preserve fire-and-forget delivery, one notification per top-level finished turn, and non-disclosure of SendKeys.

## Release contract

Read `docs/RELEASING.md` before changing any version. A normal release is:

1. Commit functional changes and update the package changelog.
2. Run `npm run release -- <package> <version>` to prepare the version commit and Tag locally.
3. Inspect the commit and Tag.
4. Run the same command with `--push`, or push the already-prepared main branch and Tag explicitly.
5. Watch the `Publish npm packages` GitHub workflow and verify npm provenance.

If an Agent sees `ENEEDAUTH` inside `publish.yml`, it must diagnose Trusted Publisher fields and OIDC permissions. It must never fall back to inventing or requesting a persistent npm token.
