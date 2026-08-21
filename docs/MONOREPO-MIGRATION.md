# Monorepo migration

## Canonical repository

`https://github.com/nickhelion/dsh-plugins` is the canonical source for both packages.

| Former repository | Canonical package path | npm name |
| --- | --- | --- |
| `nickhelion/dsh-qwen-token-plan-cn-responses` | `packages/qwen-token-plan-cn-responses` | `dsh-qwen-token-plan-cn-responses` |
| `nickhelion/dsh-serverchan-notify` | `packages/serverchan-notify` | `dsh-serverchan-notify` |

The Qwen repository is renamed in place so GitHub redirects old URLs and preserves repository age/issues/releases. The ServerChan history is merged with `git subtree`; its former repository becomes an archived migration pointer after ecosystem listings are updated.

## Compatibility

- npm package names do not change.
- DSH provider/entry ids do not change.
- Existing local settings, credential references and ServerChan key files do not change.
- Existing GitHub links redirect or remain as an archived pointer.

## Local installation migration

Development links should point directly at the package directory:

```bash
dsh plugin --profile web add /path/to/dsh-plugins/packages/qwen-token-plan-cn-responses
dsh plugin --profile web add /path/to/dsh-plugins/packages/serverchan-notify
```

Normal users should install the npm names instead.
