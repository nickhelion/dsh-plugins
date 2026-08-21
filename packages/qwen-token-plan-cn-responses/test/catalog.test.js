import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { CatalogManager, parseOfficialCatalog } from "../lib/catalog.js";
import { DOCS } from "./fixtures.js";

test("官方目录按个人版与 Responses 交集组装，并独立读取工具表", () => {
  const catalog = parseOfficialCatalog(DOCS, "2026-08-20T00:00:00.000Z");
  assert.deepEqual(catalog.models.map((model) => model.id), ["qwen3.8-max", "qwen3.7-max", "deepseek-v4-pro-0813"]);
  assert.equal(catalog.models[0].harnessTools.length, 5);
  assert.equal(catalog.models[2].harnessTools.length, 0);
  assert.equal(catalog.models[0].contextWindow, 983616);
});

test("CatalogManager 在网络失败时保留磁盘 last-known-good", async () => {
  const directory = await mkdtemp(join(tmpdir(), "qwen-catalog-test-"));
  const cacheFile = join(directory, "catalog.json");
  const urls = Object.fromEntries(Object.keys(DOCS).map((key) => [key, `https://docs.test/${key}`]));
  const fetchDocs = async (url) => {
    const key = url.split("/").at(-1);
    return new Response(DOCS[key], { status: 200, headers: { etag: `"${key}"` } });
  };
  const first = new CatalogManager({ cacheFile, urls, fetchImpl: fetchDocs, refreshMs: 0, logger: {} });
  const live = await first.start();
  assert.equal(live.source, "official-docs");

  const warnings = [];
  const offline = new CatalogManager({
    cacheFile, urls, refreshMs: 0,
    fetchImpl: async () => { throw new Error("offline"); },
    logger: { warn: (message) => warnings.push(message) },
  });
  const cached = await offline.start();
  assert.equal(cached.fingerprint, live.fingerprint);
  assert.equal(warnings.length, 1);
});
