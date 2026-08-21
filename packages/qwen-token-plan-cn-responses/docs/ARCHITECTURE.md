# Architecture

## First-principles boundary

DeepSeek Harness owns conversation state, local tools, attachments, credentials and a provider-neutral streaming vocabulary. Token Plan exposes Responses and Chat dialects; Qwen server-side Harness tools require Responses, while GLM reasoning controls currently work reliably through Chat. The plugin translates both without leaking either wire format into DSH.

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

`buildChatRequestBody()` is the isolated GLM seam. It serializes the same provider-neutral history into Chat messages, maps only DSH local tools, and sends the independent `none/high/max` reasoning controls. No other model crosses this route.

### Stream adapter

`responsesToDshChunks()` is a state machine over Responses SSE events. It assigns DSH block indexes, accumulates text/reasoning/function arguments, records provider-executed tool activity, emits usage before exactly one terminal finish, and refuses unterminated streams.

Server-side calls cannot become DSH tool-call blocks: those blocks mean “DSH must execute this function”. Instead, completed provider-side activity is rendered as a concise trailing text block, including web sources where available.

`chatToDshChunks()` separately maps GLM Chat deltas (`reasoning_content`, text and local function calls) into the same DSH stream vocabulary.

### Credential seam

The Adapter stores only `apiKeyEnv`, a credential reference. Each `stream()` resolves the current value through `ctx.credentials`; this preserves rotation without a plugin restart. Neither the release catalog nor adapter instance retains the secret.

## Request flow

1. DSH selects the registered provider/model route.
2. Adapter reads the release-bundled catalog snapshot and resolves the credential.
3. The catalog chooses Responses for normal models and Chat only for `glm-5.2`.
4. The matching content adapter builds stateless full-history input.
5. Responses tool policy intersects plugin configuration with the model's official capability set; Chat receives only DSH local tools.
6. Adapter performs one HTTP request with DSH attribution.
7. The matching stream adapter maps SSE events to DSH chunks.
8. DSH persists the final provider-neutral assistant message.

## Deliberate limitations

- The release catalog tracks reviewed official documentation and probe evidence, not an undocumented `/models` endpoint.
- Installed versions never refresh themselves; updates arrive through a new npm release.
- Provider-side tool activity is display/replay text, not a new structured DSH block.
- Unknown models may be called but receive no invented capacity metadata and no server-side tools.
- `previous_response_id` is not used; DSH remains the durable source of conversation history.
