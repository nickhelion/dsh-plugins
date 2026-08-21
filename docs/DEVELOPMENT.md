# Development

## Workspaces

The root is private and never published. Public packages live under `packages/*` and retain independent versions.

```bash
npm ci
npm run check
npm run pack:check
npm run security:scan
```

The root runner invokes package scripts through npm's own CLI path, so it works even where `npm` is available only through Corepack.

## Dependency policy

- Runtime dependencies must be explicit.
- Official DSH/Cordis services belong in `peerDependencies` and matching `devDependencies` for tests.
- Do not add a build step when plain ESM is sufficient.
- Do not add install lifecycle scripts. npm v12 intentionally disables dependency scripts, Git URLs, and remote URLs unless users opt in; npm registry packages containing prebuilt JavaScript are the supported installation path.

## Tests

- Tests are deterministic and network-free by default.
- Live Qwen catalog checks fetch public docs but never credentials.
- Live ServerChan pushes are manual and bill/notify real services; never run them in CI.

## Adding a package

1. Create `packages/<slug>/package.json` with a unique npm name and `dsh.bundle.patch`.
2. Add package README, LICENSE, AGENTS, tests, repository `directory`, and explicit peers.
3. Add a Tag prefix mapping to `scripts/release.mjs` and `.github/workflows/publish.yml`.
4. Extend `scripts/check-packages.mjs` expectations.
5. Bootstrap the npm package interactively, configure the same trusted `publish.yml`, then disallow token publishing.
