import assert from "node:assert/strict";
import test from "node:test";

import { buildChatRequestBody, chatToDshChunks } from "../lib/chat.js";
import { sseResponse } from "./fixtures.js";

test("GLM Chat 请求保留 DSH 本地工具、多轮工具结果和独立推理档位", async () => {
  const body = await buildChatRequestBody({
    model: "glm-5.2",
    system: "你是助手",
    reasoningEffort: "max",
    maxTokens: 2048,
    messages: [
      { id: "m1", role: "user", source: { kind: "user" }, content: [{ type: "text", text: "查询" }] },
      { id: "m2", role: "assistant", source: { kind: "model", provider: "p", model: "m" }, content: [
        { type: "reasoning", text: "先调用工具" },
        { type: "tool-call", id: "call_1", name: "lookup", arguments: "{\"q\":\"x\"}" },
      ] },
      { id: "m3", role: "user", source: { kind: "tool", callId: "call_1" }, content: [
        { type: "tool-result", toolCallId: "call_1", content: [{ type: "text", text: "结果" }] },
      ] },
    ],
    tools: [{ name: "lookup", description: "查询", parameters: { type: "object" } }],
  }, { id: "glm-5.2", input: ["text"], maxTokens: 131072 });

  assert.equal(body.stream, true);
  assert.deepEqual(body.stream_options, { include_usage: true });
  assert.equal(body.enable_thinking, true);
  assert.equal(body.reasoning_effort, "max");
  assert.equal(body.max_completion_tokens, 2048);
  assert.equal(body.messages[0].role, "system");
  assert.equal(body.messages[2].reasoning_content, "先调用工具");
  assert.equal(body.messages[3].role, "tool");
  assert.equal(body.tools[0].function.name, "lookup");
});

test("GLM Chat 的 none 明确关闭思考", async () => {
  const body = await buildChatRequestBody({
    model: "glm-5.2",
    reasoningEffort: "none",
    messages: [{ id: "m1", role: "user", source: { kind: "user" }, content: [{ type: "text", text: "hi" }] }],
  }, { id: "glm-5.2", input: ["text"], maxTokens: 131072 });
  assert.equal(body.enable_thinking, false);
  assert.equal(body.reasoning_effort, "none");
});

test("GLM Chat SSE 映射推理、文本、函数调用和 usage", async () => {
  const response = sseResponse([
    { choices: [{ delta: { reasoning_content: "思考" } }] },
    { choices: [{ delta: { content: "答案" } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, id: "call_9", function: { name: "shell", arguments: "{\"cmd\":" } }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: "\"pwd\"}" } }] }, finish_reason: "tool_calls" }] },
    { choices: [], usage: { prompt_tokens: 10, completion_tokens: 8, prompt_tokens_details: { cached_tokens: 3 }, completion_tokens_details: { reasoning_tokens: 2 } } },
  ]);
  const chunks = [];
  for await (const chunk of chatToDshChunks(response.body)) chunks.push(chunk);
  assert.equal(chunks.find((chunk) => chunk.type === "reasoning-delta").text, "思考");
  assert.equal(chunks.find((chunk) => chunk.type === "text-delta").text, "答案");
  assert.equal(chunks.find((chunk) => chunk.type === "block-end" && chunk.block.type === "tool-call").block.arguments, "{\"cmd\":\"pwd\"}");
  assert.deepEqual(chunks.find((chunk) => chunk.type === "usage").usage, { inputTokens: 7, outputTokens: 8, cacheReadTokens: 3, reasoningTokens: 2 });
  assert.equal(chunks.at(-1).reason.kind, "tool-calls");
});
