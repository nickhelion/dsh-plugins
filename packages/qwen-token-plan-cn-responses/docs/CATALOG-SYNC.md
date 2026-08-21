# Release-time official catalog synchronization

## Boundary

The installed plugin never fetches documentation and never mutates its model list. `lib/catalog.snapshot.json` is generated in the repository, reviewed, versioned, and shipped in the npm tarball. Therefore one package version always exposes the same catalog.

## Primary sources

The maintainer sync reads five machine-readable official Markdown documents:

1. Personal model membership: <https://platform.qianwenai.com/docs/token-plan/personal/token-plan-personal-overview.md>
2. Per-model Harness capability table: <https://platform.qianwenai.com/docs/token-plan/best-practices/built-in-tools.md>
3. OpenClaw model parameters: <https://platform.qianwenai.com/docs/developer-guides/clients-and-developer-tools/openclaw.md>
4. Responses-supported model list and wire schema: <https://platform.qianwenai.com/docs/api-reference/chat/openai-responses.md>
5. Model-specific reasoning semantics: <https://platform.qianwenai.com/docs/api-reference/chat/openai-chat.md>

`catalog/reasoning-probes.json` is separate reviewed evidence from the first-party Token Plan Responses endpoint. It records accepted/rejected wire values, semantic UI efforts, aliases, and the verification date without storing prompts, responses, or credentials.

## Compile algorithm

1. Parse Personal rows whose capability contains `文本生成`.
2. Parse the Responses schema's explicit supported-model list.
3. Intersect those IDs while preserving Personal documentation order.
4. Attach context window, output cap and input modalities from the OpenClaw example.
5. Parse documented reasoning profiles, then apply reviewed Responses-probe overrides. Semantic UI efforts and accepted wire values remain distinct.
6. Attach server-side tools only from the Harness document's **个人版** table.
7. Reject the whole candidate if any source or critical parse is incomplete.
8. Compare the candidate with `lib/catalog.snapshot.json`; do nothing when identical.

## Daily pull-request workflow

`.github/workflows/catalog-sync.yml` runs daily and on manual dispatch:

1. Fetch and compile the public documents with `npm run catalog:sync --workspace dsh-qwen-token-plan-cn-responses`.
2. If the snapshot changed, prepare a patch version, changelog entry, README pin and root lockfile.
3. Run deterministic tests and the npm tarball audit.
4. Force-update the automation-owned branch and open or refresh one pull request.
5. Require review. New models or reasoning changes must be checked with the local, credential-safe `reasoning:probe` command before merge.
6. Merging the reviewed catalog PR triggers `publish.yml`, which publishes through npm Trusted Publishing and creates the package tag/release.

No npm token or provider credential exists in repository Actions secrets.

## Failure behavior

- Any fetch/parse/schema failure makes the scheduled workflow fail without changing `main`.
- A transient provider 429/5xx is inconclusive and must not remove an existing model.
- A documented new model without reviewed reasoning evidence may be listed conservatively without invented effort controls.
- A documentation/API conflict blocks unsafe controls. For example, `glm-5.2` currently rejects the documented `high/xhigh/max` values on the Personal Responses endpoint, so the release snapshot does not expose that selector.
- `/models` is only a drift signal: it has historically returned 401 and currently omits a model that official docs and POST calls support.

See [`REASONING-CATALOG-RESEARCH.md`](REASONING-CATALOG-RESEARCH.md) for evidence and the complete probe matrix.
