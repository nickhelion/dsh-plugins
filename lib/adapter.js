import {
  LlmAdapter,
  LlmError,
  ReasoningEffortId,
  assertUsableApiKey,
  attributionHeaders,
} from "@deepseek-ai/dsh-llm";
import { credentialRef } from "@deepseek-ai/dsh-credentials";

import { buildRequestBody } from "./content.js";
import { describeHarnessTools, selectHarnessTools } from "./harness.js";
import { responsesToDshChunks } from "./sse.js";

const EFFORTS = Object.freeze([
  { id: ReasoningEffortId("low"), name: "低" },
  { id: ReasoningEffortId("medium"), name: "中" },
  { id: ReasoningEffortId("xhigh"), name: "超高" },
]);

function retryAfterMs(headers) {
  const raw = headers.get("retry-after");
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const at = Date.parse(raw);
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : undefined;
}

function httpFailure(status, text) {
  const lower = text.toLowerCase();
  if (status === 401 || status === 403) return "AUTH";
  if (status === 429) return /credit|quota|余额|额度|套餐/.test(lower) ? "QUOTA" : "RATE_LIMIT";
  if (status === 408) return "TIMEOUT";
  if (status >= 500) return "SERVER_ERROR";
  if (/context|token.*(limit|maximum)|上下文|超出.*token/.test(lower)) return "CONTEXT_WINDOW_EXCEEDED";
  return "PROVIDER_ERROR";
}

function displayModel(provider, model, syncedAt) {
  const count = model.harnessTools.length;
  return {
    provider,
    id: model.id,
    name: count ? `${model.id}（内置工具 ${count} 项）` : `${model.id}（仅 DSH 工具）`,
    description: `Responses API；内置工具：${describeHarnessTools(model.harnessTools)}；官方目录同步：${syncedAt}`,
    inputModalities: [...model.input],
  };
}

/** Qwen Token Plan 个人版 Responses API Adapter。 */
export class QwenTokenPlanResponsesAdapter extends LlmAdapter {
  constructor({ ctx, catalog, providerId, displayName, apiKeyEnv, endpoint, harnessMode, fetchImpl = globalThis.fetch }) {
    super();
    this.ctx = ctx;
    this.catalog = catalog;
    this.providerId = providerId;
    this.displayName = displayName;
    this.apiKeyEnv = apiKeyEnv;
    this.endpoint = endpoint;
    this.harnessMode = harnessMode;
    this.fetchImpl = fetchImpl;
  }

  providerInfo(provider) { return { id: provider, name: this.displayName }; }

  #model(modelId) { return this.catalog.snapshot().models.find((model) => model.id === modelId); }

  async listModels(provider) {
    const catalog = this.catalog.snapshot();
    return catalog.models.map((model) => displayModel(provider, model, catalog.syncedAt));
  }

  async resolveModel(provider, modelId) {
    const catalog = this.catalog.snapshot();
    const model = this.#model(modelId);
    if (!model) return { provider, id: modelId, name: modelId, description: "未出现在当前官方目录中；可尝试调用，但不注入内置工具", inputModalities: ["text"] };
    return {
      ...displayModel(provider, model, catalog.syncedAt),
      ...(Number.isFinite(model.contextWindow) ? { context: { contextWindow: model.contextWindow } } : {}),
      ...(Number.isFinite(model.maxTokens) ? { defaultMaxTokens: model.maxTokens } : {}),
      ...(model.reasoning ? { reasoning: { efforts: EFFORTS, defaultEffort: ReasoningEffortId("xhigh") } } : {}),
    };
  }

  async #apiKey() {
    const service = this.ctx.get?.("credentials");
    const hit = service ? await service.resolve(credentialRef(this.apiKeyEnv)) : undefined;
    const raw = hit?.value ?? process.env[this.apiKeyEnv];
    if (!raw) throw new LlmError(`未配置凭据 ${this.apiKeyEnv}；请在 DSH 模型页保存一次，无需写入插件配置`, "MISSING_CREDENTIAL");
    return assertUsableApiKey(raw, "dsh-qwen-token-plan-cn-responses", this.apiKeyEnv);
  }

  async *stream(options) {
    const model = this.#model(options.model) ?? {
      id: options.model, reasoning: false, input: ["text"], maxTokens: options.maxTokens ?? 16384, harnessTools: [],
    };
    const key = await this.#apiKey();
    const attachments = this.ctx.get?.("attachments");
    const harnessTools = selectHarnessTools(model.harnessTools, this.harnessMode);
    const request = await buildRequestBody(options, model, attachments, harnessTools);

    let response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          ...attributionHeaders(),
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(request),
        signal: options.signal,
      });
    } catch (error) {
      if (options.signal?.aborted) throw new LlmError("Qwen Responses 请求已取消", "ABORTED", { cause: error });
      throw new LlmError(`无法连接 Qwen Token Plan Responses API：${error instanceof Error ? error.message : String(error)}`, "NETWORK", { cause: error });
    }
    if (!response.ok || !response.body) {
      const text = (await response.text().catch(() => "")).slice(0, 2000);
      throw new LlmError(`Qwen Token Plan Responses API 返回 HTTP ${response.status}${text ? `：${text}` : ""}`,
        httpFailure(response.status, text), {
          status: response.status,
          ...(retryAfterMs(response.headers) !== undefined ? { providerRetryAfterMs: retryAfterMs(response.headers) } : {}),
        });
    }
    yield* responsesToDshChunks(response.body, options.signal);
  }
}
