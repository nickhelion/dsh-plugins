# Security policy

## Reporting

Please report vulnerabilities through GitHub's private **Report a vulnerability** flow for this repository. Do not include live credentials in a public issue.

## Secret-handling design

- The plugin configuration stores `QWEN_TOKEN_PLAN_CN_API_KEY`, which is a reference name, not the key.
- A key is resolved per request through the DSH credential service. An environment variable is used only when that service is absent.
- The key appears only in the outbound `Authorization` header.
- Errors identify the credential reference, never any substring of its value.
- Catalog downloads do not receive the key.
- The catalog cache stores only public documentation, validators and parsed model metadata with mode `0600`.

## Pre-publication check

Before publishing from a configured workstation, compare every tracked file against the exact local secret without printing the secret, then scan common token patterns and the full Git history. Also inspect `npm pack --dry-run` so credential files and caches cannot enter a package tarball.

## Supported versions

Security fixes are made on the latest release. Until a stable `1.0.0`, upgrade to the newest `0.x` tag rather than expecting backports.
