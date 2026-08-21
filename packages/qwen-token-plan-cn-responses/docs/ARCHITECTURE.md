# Architecture

## First-principles boundary

DeepSeek Harness owns conversation state, local tools, attachments, credentials and a provider-neutral streaming vocabulary. Qwen owns one HTTP Responses dialect and server-side Harness tools. The plugin should translate between those two systems without leaking either system's wire details into the other.

The public module is deliberately deep: `QwenTokenPlanResponsesAdapter` exposes the small DSH `LlmAdapter` interface while hiding document synchronization, capability policy, message conversion, HTTP classification and SSE lifecycle complexity.

## Modules and seams

### Catalog seams

The runtime seam is deliberately tiny: `CatalogSnapshot.snapshot()` returns the deeply frozen, release-bundled `catalog.snapshot.json`. It has no fetch, refresh, cache, timer or mutation interface.

Official-document complexity lives on the maintainer side instead. Pure parsers in `catalog-source.js` compile injected document strings; `scripts/sync-catalog.mjs` is the only fetch adapter. The daily repository workflow runs that adapter and proposes a versioned snapshot through a pull request. Runtime cannot cross this seam accidentally.

### Content adapter

`buildRequestBody()` converts DSH messages into stateless Responses input items:

- system/user text becomes system or `input_text` content;
- durable DSH images are resolved only at request time and become data URLs;
- assistant text and function calls are replayed;
- tool results become `function_call_output` items;
- historical reasoning is not replayed as provider-native reasoning.

DSH local tools are declared as `type: function`. Server-side Qwen tools are separate zero-configuration declarations such as `{ "type": "web_search" }`.

### Stream adapter

`responsesToDshChunks()` is a state machine over Responses SSE events. It assigns DSH block indexes, accumulates text/reasoning/function arguments, records provider-executed tool activity, emits usage before exactly one terminal finish, and refuses unterminated streams.

Server-side calls cannot become DSH tool-call blocks: those blocks mean “DSH must execute this function”. Instead, completed provider-side activity is rendered as a concise trailing text block, including web sources where available.

### Credential seam

The Adapter stores only `apiKeyEnv`, a credential reference. Each `stream()` resolves the current value through `ctx.credentials`; this preserves rotation without a plugin restart. Neither the release catalog nor adapter instance retains the secret.

## Request flow

1. DSH selects the registered provider/model route.
2. Adapter reads the release-bundled catalog snapshot and resolves the credential.
3. Content Adapter builds stateless full-history Responses input.
4. Tool policy intersects plugin configuration with the model's official capability set.
5. Adapter performs one HTTP request with DSH attribution.
6. Stream Adapter maps SSE events to DSH chunks.
7. DSH persists the final provider-neutral assistant message.

## Deliberate limitations

- The release catalog tracks reviewed official documentation and probe evidence, not an undocumented `/models` endpoint.
- Installed versions never refresh themselves; updates arrive through a new npm release.
- Provider-side tool activity is display/replay text, not a new structured DSH block.
- Unknown models may be called but receive no invented capacity metadata and no server-side tools.
- `previous_response_id` is not used; DSH remains the durable source of conversation history.
