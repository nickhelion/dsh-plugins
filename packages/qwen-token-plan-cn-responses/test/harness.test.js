import assert from "node:assert/strict";
import test from "node:test";

import { HARNESS_TOOL_LABELS, formatHarnessActivity, formatHarnessEntry, normalizeHarnessMode, selectHarnessTools } from "../lib/harness.js";

test("auto 使用模型全部官方能力，显式列表取交集并补 web_search", () => {
  const supported = ["web_search", "code_interpreter", "web_extractor"];
  assert.deepEqual(selectHarnessTools(supported, normalizeHarnessMode("auto")), supported);
  assert.deepEqual(selectHarnessTools(supported, normalizeHarnessMode("web_extractor")), ["web_search", "web_extractor"]);
  assert.deepEqual(selectHarnessTools(supported, normalizeHarnessMode("none")), []);
});

test("内置工具活动包含查询和来源", () => {
  const rendered = formatHarnessActivity([{ type: "web_search_call", data: { action: { queries: ["DSH"], sources: [{ url: "https://example.test/source" }] } } }]);
  assert.match(rendered, /联网搜索/);
  assert.match(rendered, /https:\/\/example\.test\/source/);
});

test("单条工具项用 emoji + 中文粗体标签并明确标注千问内置", () => {
  const search = formatHarnessEntry({ type: "web_search_call", data: { action: { queries: ["杭州天气"], sources: [{ url: "https://example.test/w" }] } } });
  assert.match(search, /\*\*🔎 联网搜索（千问内置）\*\*/);
  assert.match(search, /杭州天气/);
  assert.match(search, /https:\/\/example\.test\/w/);
  const code = formatHarnessEntry({ type: "code_interpreter_call", data: { code: "print(1)", outputs: [{ type: "logs", logs: "1\n" }] } });
  assert.match(code, /\*\*🧮 代码解释器（千问内置）\*\*/);
  assert.match(code, /```python/);
});

test("图片工具中文语义遵循 Responses 参数：queries 是文搜图，bbox 是以图搜图", () => {
  assert.equal(HARNESS_TOOL_LABELS.web_search_image, "文搜图");
  assert.equal(HARNESS_TOOL_LABELS.image_search, "以图搜图");
  assert.match(formatHarnessActivity([{ type: "web_search_image_call", data: { output: "[]" } }]), /文搜图/);
  assert.match(formatHarnessActivity([{ type: "image_search_call", data: { output: "[]" } }]), /以图搜图/);
});
