# Security policy

## Reporting

Please report vulnerabilities through the monorepo's private **Report a vulnerability** flow. Do not include live credentials in a public issue.

## Secret-handling design

- The plugin configuration stores `QWEN_TOKEN_PLAN_CN_API_KEY`, which is a reference name, not the key.
- A key is resolved per request through the DSH credential service. An environment variable is used only when that service is absent.
- The key appears only in the outbound `Authorization` header.
- Errors identify the credential reference, never any substring of its value.
- Catalog downloads do not receive the key.
- The catalog cache stores only public documentation, validators and parsed model metadata with mode `0600`.

## Pre-publication check

Before publishing from a configured workstation, run `npm run security:scan` from the monorepo root. It compares current files and the full Git history against known local credentials without printing them. Also run `npm run pack:check` so credential files and caches cannot enter a package tarball.

## Supported versions

Security fixes are made on the latest release. Until a stable `1.0.0`, upgrade to the newest `0.x` tag rather than expecting backports.
