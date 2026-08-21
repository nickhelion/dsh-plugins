# Security policy

## Reporting

Use GitHub's private **Report a vulnerability** flow for `nickhelion/dsh-plugins`. Do not place credentials or exploit details in a public issue.

## Credential boundaries

- Qwen API keys are resolved from DSH credential references per request.
- ServerChan SendKeys come from environment/configured files and never from repository defaults.
- npm publication uses GitHub OIDC after the one-time interactive package bootstrap.
- No GitHub or npm secret is stored in repository Actions secrets for publishing.
- Catalog caches, DSH session histories and local credential files are not repository inputs.

## Supply-chain posture

- Public packages contain no install lifecycle scripts.
- CI uses `npm ci --ignore-scripts` before testing explicit commands.
- Release jobs use GitHub-hosted runners and `id-token: write` only for the publish job.
- `npm run pack:check` rejects credential/cache filenames and unexpected missing package docs.
- `npm run security:scan` compares known local credential values against current files and the full Git history without printing the values.
- Trusted Publisher should be paired with npm's “Require 2FA and disallow tokens” package setting after bootstrap succeeds.

## Supported versions

Security fixes target the latest release of each independently versioned package.
