# Contributing

Contributions are welcome, especially fixtures for newly documented Qwen Responses events and parser updates following official documentation changes.

## Setup

```bash
git clone https://github.com/nickhelion/dsh-plugins.git
cd dsh-plugins
npm ci
npm run check --workspace dsh-qwen-token-plan-cn-responses
```

Node.js 22.19 or newer is required to match current DeepSeek Harness releases.

## Pull requests

- Keep runtime authority in official docs, not README tables or copied third-party catalogs.
- Add or update a deterministic fixture test for every parser/wire change.
- Do not put real API keys, credential files, prompt transcripts or probe responses in issues, fixtures or commits.
- Avoid live provider calls in CI. If a live call is essential during development, use a minimal interactive prompt and report only redacted outcomes.
- Explain whether a change affects DSH local functions, Qwen server-side tools, or both.

## Commit style

Use small, imperative commits with a conventional prefix where useful: `feat:`, `fix:`, `test:`, `docs:`, `chore:`. Do not rewrite public history after a release tag.
