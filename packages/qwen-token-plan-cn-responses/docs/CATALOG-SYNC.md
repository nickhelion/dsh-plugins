# Official catalog synchronization

## Sources

The runtime reads five machine-readable Markdown documents:

1. Personal model membership: <https://platform.qianwenai.com/docs/token-plan/personal/token-plan-personal-overview.md>
2. Per-model Harness capability table: <https://platform.qianwenai.com/docs/token-plan/best-practices/built-in-tools.md>
3. OpenClaw model parameters: <https://platform.qianwenai.com/docs/developer-guides/clients-and-developer-tools/openclaw.md>
4. Responses-supported model list and wire schema: <https://platform.qianwenai.com/docs/api-reference/chat/openai-responses.md>
5. Model-specific reasoning-effort profiles: <https://platform.qianwenai.com/docs/api-reference/chat/openai-chat.md>

## Merge algorithm

1. Parse Personal rows whose capability contains `文本生成`.
2. Parse the Responses schema's explicit supported-model list.
3. Intersect those IDs while preserving Personal documentation order.
4. Attach context window, output cap and input modalities from the Personal OpenClaw JSON example.
5. Attach model-specific reasoning efforts/defaults from the API reference. OpenClaw's `reasoning` boolean is not treated as a Responses effort-capability flag.
6. Attach server-side tools only from the Harness document's **个人版** table.
7. Validate that every source was present and all critical parses were non-empty.
8. Atomically publish and persist the complete snapshot.

The embedded catalog is bootstrap availability, not runtime authority. It lets the provider appear during a first offline boot. Once an official snapshot succeeds, it becomes last-known-good.

## Failure behavior

- Conditional requests use ETag and Last-Modified when the server supplies them.
- Any failed request or parse rejects the whole candidate snapshot.
- A rejected candidate does not mutate in-memory or on-disk last-known-good state.
- Writes use a temporary file followed by rename.
- The cache contains public documentation and parsed metadata only; it never contains credentials or prompts.

## Why not query `/models`

A provider listing commonly returns IDs without context, modalities, reasoning semantics or per-model built-in tool support. The user-facing selector needs those facts, and the official documentation is the authoritative source that actually states them.
