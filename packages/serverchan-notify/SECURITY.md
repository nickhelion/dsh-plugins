# Security

Report vulnerabilities through the canonical monorepo's private vulnerability-reporting flow: <https://github.com/nickhelion/dsh-plugins/security>.

Never attach a real ServerChan SendKey to an issue. The plugin must keep delivery fire-and-forget, resolve secrets at runtime, and avoid logging credentials or embedding them in browser-visible configuration.

Publishing follows the root [`docs/RELEASING.md`](../../docs/RELEASING.md) OIDC workflow; no long-lived npm publish token belongs in this package or repository.
