# Contributing

Contributions to either plugin are welcome.

## Setup

```bash
git clone https://github.com/nickhelion/dsh-plugins.git
cd dsh-plugins
npm ci
npm run check
npm run pack:check
npm run security:scan
```

## Pull requests

- Keep changes inside one package when possible.
- Update English and Chinese package docs together where both exist.
- Add deterministic tests for protocol, parser, event, or configuration changes.
- Never include live credentials, local DSH session history, caches, or absolute workstation paths.
- Explain network/data/credential effects in the PR description.
- Do not bump versions in ordinary feature PRs; releases use the documented package-specific flow.

## Commits

Use small imperative commits. Conventional prefixes (`feat:`, `fix:`, `test:`, `docs:`, `chore:`) are encouraged. The merged monorepo intentionally retains both standalone repositories' histories.
