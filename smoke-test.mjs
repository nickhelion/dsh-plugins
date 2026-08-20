/**
 * 冒烟测试：在两个独立的 cordis 根上下文里挂载 dsh-serverchan-notify，
 * 覆盖两条 URL 推导分支、回合过滤规则与子代理开关。
 * fetch 被替换为探针，不会真实推送；REPORT=1 可打印完整报文。
 *
 * 先 `npm install`（安装 devDependency @deepseek-ai/cordis），再：
 *   node smoke-test.mjs
 */
import { Context } from "@deepseek-ai/cordis";
import plugin from "./lib/index.js";

// 探针：捕获所有推送请求，不真正发送
const pushes = [];
globalThis.fetch = async (url, init) => {
  const body = new URLSearchParams(init.body.toString());
  pushes.push({ url, title: body.get("title"), desp: body.get("desp") });
  return { ok: true, status: 200, json: async () => ({ code: 0, message: "SUCCESS" }) };
};

function fakeSession(overrides = {}) {
  return {
    id: "session-test-1",
    header: { cwd: "/tmp/example-project", delegationDepth: 0 },
    events: [
      { type: "session/title", data: { title: "冒烟测试对话" } },
      { type: "assistant/message", data: { message: { content: [{ type: "text", text: "你好，这是测试回复正文。" }] } } },
    ],
    requestHeader: () => ({ config: { provider: "deepseek-official", model: "deepseek-v4-pro" } }),
    ...overrides,
  };
}

// 场景 1：不带通道号的 key → 通用域名；验证默认过滤
// （子代理不推、非 turn/end 不推、interrupted 不推）
const root1 = new Context();
await root1.plugin(plugin, {
  sendkey: "SMOKE-TEST-FAKE-KEY",
  reasons: ["completed", "blocked", "error", "max-tokens", "aborted"],
  notifySubagents: false,
});
root1.emit("session/event", fakeSession(), { type: "turn/end", data: { turn: 1, reason: { kind: "completed" } } });
root1.emit("session/event", fakeSession({ id: "session-sub-1", header: { delegationDepth: 1 } }), { type: "turn/end", data: { turn: 1, reason: { kind: "completed" } } });
root1.emit("session/event", fakeSession(), { type: "step/end", data: { turn: 1, step: 1 } });
root1.emit("session/event", fakeSession(), { type: "turn/end", data: { turn: 2, reason: { kind: "interrupted" } } });

// 场景 2：带通道号的 key → 专属 push 域名；notifySubagents: true 时子代理也推
const root2 = new Context();
await root2.plugin(plugin, {
  sendkey: "sctp1234t-FAKE-TEST-KEY-NOT-REAL",
  notifySubagents: true,
});
root2.emit("session/event", fakeSession(), { type: "turn/end", data: { turn: 1, reason: { kind: "completed" } } });
root2.emit("session/event", fakeSession({ id: "session-sub-1", header: { delegationDepth: 1 } }), { type: "turn/end", data: { turn: 1, reason: { kind: "completed" } } });

// 等待异步 deliver 完成
await new Promise((resolve) => setTimeout(resolve, 1500));

function assert(condition, message) {
  if (condition) return;
  console.error(`✘ ${message}`);
  process.exitCode = 1;
}

const generic = pushes.find((p) => p.url.startsWith("https://sctapi.ftqq.com/"));
const ft07 = pushes.filter((p) => p.url.startsWith("https://1234.push.ft07.com/"));

assert(pushes.length === 3, `预期 3 次推送（1 通用域名 + 2 专属域名），实际 ${pushes.length} 次`);
assert(generic?.url === "https://sctapi.ftqq.com/SMOKE-TEST-FAKE-KEY.send", "通用域名 URL 推导错误");
assert(ft07.length === 2, `专属域名分支预期 2 次推送（顶层 + 子代理），实际 ${ft07.length} 次`);
assert(ft07.every((p) => p.url === "https://1234.push.ft07.com/send/sctp1234t-FAKE-TEST-KEY-NOT-REAL.send"), "专属 push 域名 URL 推导错误");
assert(ft07.some((p) => p.title.includes("冒烟测试对话")), "notifySubagents: true 时子代理未推送");

if (process.exitCode) {
  console.error("冒烟测试失败，捕获到的推送：");
  for (const push of pushes) console.error("  ", push.url);
  process.exit(process.exitCode);
}

console.log("✔ 全部断言通过：URL 双分支推导、子代理过滤、interrupted 忽略、notifySubagents 开关");
if (process.env.REPORT === "1") {
  for (const push of pushes) {
    console.log("\n===== 推送 =====");
    console.log("  URL:", push.url);
    console.log("  title:", push.title);
    console.log("  desp:\n" + push.desp);
  }
}
process.exit(0);
