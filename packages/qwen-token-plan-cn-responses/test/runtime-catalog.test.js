import assert from "node:assert/strict";
import test from "node:test";

import apply from "../lib/index.js";

test("插件启动不访问官方文档或其他目录网络", async () => {
  const originalFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = async () => { fetches += 1; throw new Error("runtime network is forbidden"); };
  let adapter;
  try {
    apply({
      llm: { registerAdapter: (_providers, value) => { adapter = value; return () => {}; } },
      logger: { info() {} },
      on() {},
    });
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.ok(adapter);
  assert.equal(fetches, 0);
  assert.equal((await adapter.listModels("qwen-token-plan-cn-responses")).length, 8);
});
