# Releasing npm packages

This repository follows npm's 2026 security direction: no long-lived publish token. GitHub's announcement states that bypass-2FA granular tokens lose sensitive-management bypass and are planned to lose direct publishing; npm recommends Trusted Publishing (OIDC) or staged publishing instead.

Primary references:

- <https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/>
- <https://docs.npmjs.com/trusted-publishers/>

## One-time bootstrap for a new npm package

An unpublished package has no npm Settings page, so its first public version is bootstrapped interactively:

1. Use Node.js 24.15 or newer with npm 12 or newer for the current Passkey flow. On this workstation the known-good binaries live under `~/.nvm/versions/node/v24.15.0/bin`.
2. Run `npm login --auth-type=web --registry=https://registry.npmjs.org` and complete the browser login with the npm Passkey stored in Bitwarden. npm's email-verification code is not a publishing second factor.
3. From a clean checkout, run `npm run check && npm run pack:check && npm run security:scan`, then `npm publish --workspace <name> --access public`. Open the authentication URL printed by npm and approve the Passkey. Never paste credentials into chat or a repository file.
4. Create the Trusted Publisher directly from npm CLI (no form filling and no token):

   ```bash
   npm trust github <name> \
     --file publish.yml \
     --repo nickhelion/dsh-plugins \
     --allow-publish \
     --yes
   ```

5. Set the maximum package publishing restriction. In npm CLI, `mfa=publish` means 2FA is required and automation/bypass tokens are disallowed; Trusted Publishing OIDC remains allowed:

   ```bash
   npm access set mfa=publish <name>
   ```

6. Trigger a patch release and verify the npm provenance attestation.
7. Run `npm logout --registry=https://registry.npmjs.org` and confirm `~/.npmrc` has no npm auth token.

Repeat steps 3–5 for each new package. Each package gets one Trusted Publisher, but both may authorize the same workflow filename.

## Normal Agent release (no npm login)

1. Update and commit the target package's `CHANGELOG.md` with the intended version.
2. Ensure the repository is clean and on `main`.
3. Prepare locally:

   ```bash
   npm run release -- dsh-qwen-token-plan-cn-responses 0.1.4
   # or
   npm run release -- dsh-serverchan-notify 1.0.3
   ```

4. Inspect the generated version commit and annotated Tag.
5. Push with the same command plus `--push`, or explicitly push `main` and the package Tag.
6. GitHub-hosted Actions exchanges its OIDC identity for a short-lived npm credential, publishes, and records provenance. No `NPM_TOKEN` exists.
7. Verify the exact npm version, provenance, GitHub workflow and clean Git status.

## Reviewed Qwen catalog release

The Qwen provider has a second, narrower path for official catalog drift:

1. `catalog-sync.yml` checks public official documents daily and exits without a commit when the bundled snapshot is unchanged.
2. A real change produces one automation PR containing the generated snapshot, patch version, changelog, README pin and lockfile.
3. Review model additions/removals and reasoning semantics. Run the local `reasoning:probe` maintainer command for new or changed reasoning profiles; no provider credential is stored in GitHub.
4. Merge only after review and green validation. The snapshot-path push on `main` runs this same trusted `publish.yml`, publishes through OIDC, then creates the package tag and GitHub release.

Installed plugins never fetch official documentation. Do not bypass this review path by editing the generated snapshot directly.

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
