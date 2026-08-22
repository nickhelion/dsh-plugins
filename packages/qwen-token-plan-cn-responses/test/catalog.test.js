import assert from "node:assert/strict";
import test from "node:test";

import probes from "../catalog/reasoning-probes.json" with { type: "json" };
import { BUNDLED_CATALOG, CatalogSnapshot } from "../lib/catalog.js";
import { parseOfficialCatalog } from "../lib/catalog-source.js";
import { DOCS } from "./fixtures.js";

test("官方目录按个人版与 Responses 交集组装，并独立读取工具表", () => {
  const catalog = parseOfficialCatalog(DOCS, "2026-08-20T00:00:00.000Z");
  assert.deepEqual(catalog.models.map((model) => model.id), ["qwen3.8-max", "qwen3.7-max", "deepseek-v4-pro-0813"]);
  assert.equal(catalog.models[0].harnessTools.length, 5);
  assert.equal(catalog.models[2].harnessTools.length, 0);
  assert.equal(catalog.models[0].contextWindow, 983616);
  assert.deepEqual(catalog.models[0].reasoningEfforts, ["low", "medium", "xhigh"]);
  assert.equal(catalog.models[0].defaultReasoningEffort, "xhigh");
  assert.deepEqual(catalog.models[2].reasoningEfforts, ["low", "high", "max"]);
  assert.equal(catalog.models[2].defaultReasoningEffort, "high");
});

test("探测覆盖只发布 API 已接受的推理档位", () => {
  const catalog = parseOfficialCatalog(DOCS, "2026-08-21T00:00:00.000Z", probes);
  assert.deepEqual(catalog.models[2].reasoningEfforts, ["none", "low", "high", "max"]);
  assert.ok(catalog.models[2].reasoningEfforts.every((effort) => probes.models["deepseek-v4-pro-0813"].accepted.includes(effort)));
});

test("运行时目录是随版本发布的只读快照", () => {
  const catalog = new CatalogSnapshot().snapshot();
  assert.equal(catalog, BUNDLED_CATALOG);
  assert.equal(catalog.version, 3);
  assert.equal(catalog.models.length, 8);
  assert.ok(Object.isFrozen(catalog));
  assert.ok(Object.isFrozen(catalog.models[0].reasoningEfforts));
  const glm = catalog.models.find((model) => model.id === "glm-5.2");
  assert.equal(glm.transport, "chat");
  assert.equal(glm.reasoning, true);
  assert.deepEqual(glm.reasoningEfforts, ["none", "high", "max"]);
  assert.equal(glm.defaultReasoningEffort, "high");
  assert.deepEqual(glm.rejectedReasoningEfforts, []);
});

test("内容指纹只随语义内容变化：syncedAt 与纯文档措辞改动不改变指纹", () => {
  const base = parseOfficialCatalog(DOCS, "2026-08-20T00:00:00.000Z", probes);
  // 不同的同步时间不改变指纹。
  const later = parseOfficialCatalog(DOCS, "2026-08-21T00:00:00.000Z", probes);
  assert.equal(later.fingerprint, base.fingerprint);
  // 官方文档里与目录无关的措辞改动不改变指纹。
  const cosmetic = parseOfficialCatalog(
    { ...DOCS, personal: DOCS.personal.replace("这里是用于测试的官方文档摘录", "这里是用于测试的官方文档摘录，新增一句与模型无关的说明") },
    "2026-08-20T00:00:00.000Z",
    probes,
  );
  assert.equal(cosmetic.fingerprint, base.fingerprint);
  assert.deepEqual(cosmetic.models, base.models);
  // 新增一个模型会改变指纹并进入交集。
  const substantive = parseOfficialCatalog(
    { ...DOCS, personal: DOCS.personal.replace("| 千问 | qwen3.7-max | 推理模型、文本生成 |", "| 千问 | qwen3.7-max | 推理模型、文本生成 |\n| 千问 | qwen3.6-flash | 推理模型、文本生成 |") },
    "2026-08-20T00:00:00.000Z",
    probes,
  );
  assert.notEqual(substantive.fingerprint, base.fingerprint);
  assert.ok(substantive.models.some((model) => model.id === "qwen3.6-flash"));
});
