import assert from "node:assert/strict";
import test from "node:test";

import { responsesToDshChunks } from "../lib/sse.js";
import { sseResponse } from "./fixtures.js";

test("SSE 映射文本、usage，并把内置搜索来源显式展示", async () => {
  const response = sseResponse([
    { type: "response.output_item.added", output_index: 0, item: { id: "ws_1", type: "web_search_call", status: "in_progress", action: { queries: ["Qwen"] } } },
    { type: "response.output_item.done", output_index: 0, item: { id: "ws_1", type: "web_search_call", status: "completed", action: { queries: ["Qwen"], sources: [{ url: "https://example.test/qwen" }] } } },
    { type: "response.output_item.added", output_index: 1, item: { id: "msg_1", type: "message" } },
    { type: "response.output_text.delta", output_index: 1, delta: "答案" },
    { type: "response.output_item.done", output_index: 1, item: { type: "message", content: [{ type: "output_text", text: "答案" }] } },
    { type: "response.completed", response: { status: "completed", usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12, input_tokens_details: { cached_tokens: 3 }, output_tokens_details: { reasoning_tokens: 0 } } } },
  ]);
  const chunks = [];
  for await (const chunk of responsesToDshChunks(response.body)) chunks.push(chunk);
  assert.equal(chunks.at(-1).reason.kind, "stop");
  assert.equal(chunks.find((chunk) => chunk.type === "usage").usage.inputTokens, 7);
  assert.match(chunks.filter((chunk) => chunk.type === "text-delta").at(-1).text, /example\.test\/qwen/);
});

test("SSE 原生 function_call 映射为 DSH tool-call 并以 tool-calls 结束", async () => {
  const response = sseResponse([
    { type: "response.output_item.added", output_index: 0, item: { type: "function_call", call_id: "call_9", name: "shell", arguments: "" } },
    { type: "response.function_call_arguments.delta", output_index: 0, delta: "{\"cmd\":\"pwd\"}" },
    { type: "response.output_item.done", output_index: 0, item: { type: "function_call", call_id: "call_9", name: "shell", arguments: "{\"cmd\":\"pwd\"}" } },
    { type: "response.completed", response: { status: "completed", usage: {} } },
  ]);
  const chunks = [];
  for await (const chunk of responsesToDshChunks(response.body)) chunks.push(chunk);
  const end = chunks.find((chunk) => chunk.type === "block-end");
  assert.deepEqual({ type: end.block.type, name: end.block.name, arguments: end.block.arguments }, { type: "tool-call", name: "shell", arguments: "{\"cmd\":\"pwd\"}" });
  assert.equal(chunks.at(-1).reason.kind, "tool-calls");
});
