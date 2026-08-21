# Releasing npm packages

This repository follows npm's 2026 security direction: no long-lived publish token. GitHub's announcement states that bypass-2FA granular tokens lose sensitive-management bypass and are planned to lose direct publishing; npm recommends Trusted Publishing (OIDC) or staged publishing instead.

Primary references:

- <https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/>
- <https://docs.npmjs.com/trusted-publishers/>

## One-time bootstrap for a new npm package

An unpublished package has no npm Settings page, so its first public version is bootstrapped interactively:

1. Run `npm login --auth-type=web --registry=https://registry.npmjs.org`.
2. Complete npm login and 2FA in the browser. Never paste credentials into chat or a repository file.
3. From a clean checkout, run `npm run check && npm run pack:check && npm run security:scan`, then `npm publish --workspace <name> --access public`.
4. Open the new package on npmjs.com → **Settings → Trusted Publisher**.
5. Configure GitHub Actions with these exact fields:
   - Organization or user: `nickhelion`
   - Repository: `dsh-plugins`
   - Workflow filename: `publish.yml`
   - Environment: leave blank unless the workflow is changed to use one
   - Allowed action: `npm publish`
6. Trigger a patch release and verify the npm provenance attestation.
7. Set **Publishing access → Require two-factor authentication and disallow tokens**.
8. Run `npm logout --registry=https://registry.npmjs.org` and confirm `~/.npmrc` has no npm auth token.

Repeat steps 3–7 for each new package. Each package gets one Trusted Publisher, but both may authorize the same workflow filename.

## Normal Agent release (no npm login)

1. Update and commit the target package's `CHANGELOG.md` with the intended version.
2. Ensure the repository is clean and on `main`.
3. Prepare locally:

   ```bash
   npm run release -- dsh-qwen-token-plan-cn-responses 0.1.2
   # or
   npm run release -- dsh-serverchan-notify 1.0.2
   ```

4. Inspect the generated version commit and annotated Tag.
5. Push with the same command plus `--push`, or explicitly push `main` and the package Tag.
6. GitHub-hosted Actions exchanges its OIDC identity for a short-lived npm credential, publishes, and records provenance. No `NPM_TOKEN` exists.
7. Verify the exact npm version, provenance, GitHub workflow and clean Git status.

## Tag prefixes

| Package | Tag |
| --- | --- |
| `dsh-qwen-token-plan-cn-responses` | `qwen-token-plan-cn-responses-vX.Y.Z` |
| `dsh-serverchan-notify` | `serverchan-notify-vX.Y.Z` |

The publish workflow refuses a Tag whose version differs from its package manifest.

## Never do this

- Do not commit `.npmrc` auth lines.
- Do not store `NPM_TOKEN` in GitHub Actions for these packages.
- Do not recreate the former Automation/GAT token wizard.
- Do not bypass failed OIDC by minting a persistent token; fix repository/workflow/package Trusted Publisher fields instead.
