import assert from "node:assert/strict";
import test from "node:test";

import { QwenTokenPlanResponsesAdapter } from "../lib/adapter.js";
import { CatalogSnapshot } from "../lib/catalog.js";
import { parseOfficialCatalog } from "../lib/catalog-source.js";
import { DOCS, sseResponse } from "./fixtures.js";

test("Adapter 从凭据 Seam 取 Key、注入模型工具能力并完成整条 HTTP/SSE 路径", async () => {
  const catalogValue = parseOfficialCatalog(DOCS, "2026-08-20T00:00:00.000Z");
  let wire;
  const ctx = {
    get(name) {
      return name === "credentials"
        ? { resolve: async () => ({ value: "secret-for-test", source: "test" }) }
        : undefined;
    },
  };
  const adapter = new QwenTokenPlanResponsesAdapter({
    ctx,
    catalog: { snapshot: () => catalogValue },
    providerId: "qwen-token-plan-cn-responses",
    displayName: "Qwen Responses",
    apiKeyEnv: "QWEN_TOKEN_PLAN_CN_API_KEY",
    endpoint: "https://api.test/responses",
    harnessMode: { mode: "auto" },
    fetchImpl: async (url, init) => {
      wire = { url, init, body: JSON.parse(init.body) };
      return sseResponse([
        { type: "response.output_item.added", output_index: 0, item: { type: "message" } },
        { type: "response.output_text.delta", output_index: 0, delta: "OK" },
        { type: "response.output_item.done", output_index: 0, item: { type: "message", content: [{ type: "output_text", text: "OK" }] } },
        { type: "response.completed", response: { status: "completed", usage: {} } },
      ]);
    },
  });

  const chunks = [];
  for await (const chunk of adapter.stream({
    provider: "qwen-token-plan-cn-responses",
    model: "qwen3.8-max",
    reasoningEffort: "low",
    messages: [{ id: "m1", role: "user", source: { kind: "user" }, content: [{ type: "text", text: "hi" }] }],
  })) chunks.push(chunk);

  assert.equal(wire.url, "https://api.test/responses");
  assert.equal(wire.init.headers.Authorization, "Bearer secret-for-test");
  assert.ok(wire.init.headers["user-agent"]);
  assert.deepEqual(wire.body.tools.map((tool) => tool.type), ["web_search", "code_interpreter", "web_extractor", "web_search_image", "image_search"]);
  assert.equal(chunks.at(-1).reason.kind, "stop");

  const models = await adapter.listModels("qwen-token-plan-cn-responses");
  assert.equal(models[0].name, "qwen3.8-max");
  assert.equal(models[0].description, "Responses · 5 个内置工具");
  assert.equal(models[2].name, "deepseek-v4-pro-0813");
  assert.equal(models[2].description, "Responses · 仅本地工具");

  const deepseek = await adapter.resolveModel("qwen-token-plan-cn-responses", "deepseek-v4-pro-0813");
  assert.deepEqual(deepseek.reasoning.efforts.map((effort) => effort.id), ["low", "high", "max"]);
  assert.equal(deepseek.reasoning.defaultEffort, "high");
});

test("Adapter 仅将 GLM-5.2 路由到 Chat Completions", async () => {
  let wire;
  const model = {
    id: "glm-5.2", brand: "智谱 AI", capabilities: "推理模型、文本生成", transport: "chat",
    reasoning: true, reasoningEfforts: ["none", "high", "max"], defaultReasoningEffort: "high",
    input: ["text"], contextWindow: 1048576, maxTokens: 131072, harnessTools: [],
  };
  const adapter = new QwenTokenPlanResponsesAdapter({
    ctx: { get: (name) => name === "credentials" ? { resolve: async () => ({ value: "secret-for-test" }) } : undefined },
    catalog: { snapshot: () => ({ version: 3, source: "official-docs+verified-probes", syncedAt: "2026-08-21", models: [model] }) },
    providerId: "qwen-token-plan-cn-responses",
    displayName: "Qwen Token Plan",
    apiKeyEnv: "QWEN_TOKEN_PLAN_CN_API_KEY",
    endpoint: "https://api.test/v1/responses",
    chatEndpoint: "https://api.test/v1/chat/completions",
    harnessMode: { mode: "auto" },
    fetchImpl: async (url, init) => {
      wire = { url, body: JSON.parse(init.body) };
      return sseResponse([
        { choices: [{ delta: { reasoning_content: "想" } }] },
        { choices: [{ delta: { content: "好" }, finish_reason: "stop" }] },
        { choices: [], usage: { prompt_tokens: 2, completion_tokens: 2 } },
      ]);
    },
  });

  const chunks = [];
  for await (const chunk of adapter.stream({
    provider: "qwen-token-plan-cn-responses", model: "glm-5.2", reasoningEffort: "high",
    messages: [{ id: "m1", role: "user", source: { kind: "user" }, content: [{ type: "text", text: "hi" }] }],
  })) chunks.push(chunk);

  assert.equal(wire.url, "https://api.test/v1/chat/completions");
  assert.equal(wire.body.reasoning_effort, "high");
  assert.equal(wire.body.reasoning, undefined);
  assert.equal(chunks.at(-1).reason.kind, "stop");
});

test("全部模型选择器条目只显示 ID 和精简协议工具说明", async () => {
  const adapter = new QwenTokenPlanResponsesAdapter({
    ctx: {}, catalog: new CatalogSnapshot(), providerId: "p", displayName: "p", apiKeyEnv: "KEY",
    endpoint: "https://api.test/v1/responses", harnessMode: { mode: "auto" },
  });
  const models = await adapter.listModels("p");
  assert.ok(models.every((model) => model.name === model.id));
  assert.ok(models.every((model) => /^(Responses|Chat) · (\d+ 个内置工具|仅本地工具)$/.test(model.description)));
  assert.ok(models.every((model) => model.description.length <= 24));
});
