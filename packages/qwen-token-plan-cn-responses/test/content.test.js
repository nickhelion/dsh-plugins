import assert from "node:assert/strict";
import test from "node:test";

import { buildRequestBody } from "../lib/content.js";

test("DSH 历史、函数工具与服务端内置工具共同进入 Responses 请求", async () => {
  const options = {
    model: "qwen3.8-max",
    system: "你是助手",
    messages: [
      { id: "m1", role: "user", source: { kind: "user" }, content: [{ type: "text", text: "查天气" }] },
      { id: "m2", role: "assistant", source: { kind: "model", provider: "p", model: "m" }, content: [
        { type: "tool-call", id: "call_1", name: "weather", arguments: "{\"city\":\"杭州\"}" },
      ] },
      { id: "m3", role: "user", source: { kind: "tool", callId: "call_1" }, content: [
        { type: "tool-result", toolCallId: "call_1", content: [{ type: "text", text: "晴" }], isError: false },
      ] },
    ],
    tools: [{ name: "weather", description: "天气", parameters: { type: "object" } }],
    reasoningEffort: "xhigh",
  };
  const model = { id: "qwen3.8-max", input: ["text", "image"], reasoning: true, maxTokens: 131072 };
  const body = await buildRequestBody(options, model, undefined, ["web_search"]);
  assert.equal(body.input[0].role, "system");
  assert.equal(body.input.at(-1).type, "function_call_output");
  assert.deepEqual(body.tools.map((tool) => tool.type), ["function", "web_search"]);
  assert.deepEqual(body.reasoning, { effort: "xhigh" });
});

test("DeepSeek 推理强度按原值进入 Responses reasoning.effort", async () => {
  const body = await buildRequestBody({
    model: "deepseek-v4-pro-0813",
    reasoningEffort: "max",
    tools: [],
    messages: [{ id: "m1", role: "user", source: { kind: "user" }, content: [{ type: "text", text: "hi" }] }],
  }, {
    id: "deepseek-v4-pro-0813",
    input: ["text"],
    reasoning: true,
    reasoningEfforts: ["low", "high", "max"],
    maxTokens: 32768,
  }, undefined, []);
  assert.deepEqual(body.reasoning, { effort: "max" });
});
