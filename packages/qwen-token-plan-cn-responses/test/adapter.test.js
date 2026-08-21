import assert from "node:assert/strict";
import test from "node:test";

import { QwenTokenPlanResponsesAdapter } from "../lib/adapter.js";
import { parseOfficialCatalog } from "../lib/catalog.js";
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
  assert.match(models[0].name, /内置工具 5 项/);
  assert.match(models[2].name, /仅 DSH 工具/);

  const deepseek = await adapter.resolveModel("qwen-token-plan-cn-responses", "deepseek-v4-pro-0813");
  assert.deepEqual(deepseek.reasoning.efforts.map((effort) => effort.id), ["low", "high", "max"]);
  assert.equal(deepseek.reasoning.defaultEffort, "high");
});
