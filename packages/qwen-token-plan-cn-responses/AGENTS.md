# Agent Guide

This file applies to the whole repository. Read it before editing.

## Mission

Expose Qwen Token Plan CN Personal models to DeepSeek Harness through a dedicated Responses API adapter, while deriving the advertised model and server-side tool catalog from official Qianwen documentation instead of a manually maintained list.

## Repository map

| Module | Responsibility |
| --- | --- |
| `lib/catalog.js` | Deep `CatalogManager` module: fetch, parse, validate, cache and atomically publish official catalog snapshots. |
| `lib/harness.js` | Server-side Harness tool vocabulary, policy intersection and user-visible activity rendering. |
| `lib/content.js` | Adapter from DSH provider-neutral messages/tools/images to Responses request items. |
| `lib/sse.js` | Adapter from Qwen Responses SSE events to DSH `StreamChunk` values. |
| `lib/adapter.js` | DSH `LlmAdapter` implementation and credential/network boundary. |
| `lib/index.js` | Cordis composition root. Keep it shallow. |
| `test/` | Network-free contract tests using representative official-document and SSE fixtures. |
| `docs/` | Architecture, catalog-sync and security rationale. |

## Required commands

```bash
npm ci
npm run check
npm run test:live-catalog  # optional network check; never run in deterministic CI
npm pack --dry-run
```

## Non-negotiable invariants

1. Never commit, log, snapshot or cache an API key. Configuration stores only the credential reference name.
2. Resolve the key once per model call through `ctx.credentials`; environment lookup is only the service-less fallback.
3. Never replace a working catalog with an empty, partial or invalid parse. All official sources must validate first.
4. Model membership is `Personal text-capable models ∩ Responses-supported models`.
5. Server-side Harness tools and DSH local function tools are different capabilities. Do not describe one as the other.
6. `web_extractor` must be accompanied by `web_search`.
7. In Responses semantics, `web_search_image` is text-to-image search (文搜图), while `image_search` uses an input image/bbox (以图搜图).
8. Do not add a new public content-block type merely to display server-side activity; UI, compaction and replay would all need support. Render the concise activity appendix instead.
9. Every provider request must include DSH `attributionHeaders()`.
10. Changes to wire conversion or SSE lifecycle require fixture tests before a live call.

## Official source endpoints

Prefer the machine-readable `.md` endpoints documented in `docs/CATALOG-SYNC.md`. HTML scraping is a fallback, not the primary interface. A documentation format change should fail closed and preserve last-known-good data.

## Change workflow

- Keep seams narrow: source fetching is replaceable in tests; parsing functions remain pure; the Cordis composition root only wires dependencies.
- Update README's current matrix when publishing a release, but never turn that table into runtime authority.
- When a new model appears without OpenClaw metadata, advertise it without invented context/output capacities rather than guessing.
- Run the exact-secret scan described in `SECURITY.md` before making a repository public.
