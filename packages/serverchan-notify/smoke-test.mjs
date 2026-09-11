/**
 * 冒烟测试：在独立的 cordis 根上下文里挂载 dsh-serverchan-notify，
 * 覆盖两条 URL 推导分支、回合过滤规则与子代理开关。
 * fetch 被替换为探针，不会真实推送；REPORT=1 可打印完整报文。
 *
 * 会话对象刻意做两种形状，对应 harness 的两条 API 线：
 *   - legacy：DSH 0.1.0-rc.x / 0.1.1-rc.x，日志挂在 `session.events` 上；
 *   - modern：DSH 0.1.2-rc.1 起，`Session.events` getter 已被移除，
 *     只暴露 `snapshotEvents()` / `ownEvents()`。
 * modern 形状**不含** `events` 属性，所以任何回退到 `session.events`
 * 的实现都会在这一组用例里失败 —— 这正是 1.0.2 在新版 harness 上
 * 静默不发通知的那个缺陷。
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

const TURN_END = { type: "turn/end", data: { turn: 1, reason: { kind: "completed" } } };

/** 一段最小但形状真实的会话日志：标题事件 + 一条带文本的 assistant 消息。 */
function logOf(title, reply) {
  return [
    { type: "turn/start", seq: 12, time: 0, data: { turn: 1 } },
    {
      type: "session/title",
      seq: 13,
      time: 0,
      data: { title, messageSeqs: [9], source: { kind: "fallback" } },
    },
    {
      type: "assistant/message",
      seq: 14,
      time: 0,
      data: { turn: 1, step: 1, message: { content: [{ type: "text", text: reply }] } },
    },
    { type: "turn/end", seq: 15, time: 0, data: { turn: 1, reason: { kind: "completed" } } },
  ];
}

function header(cwd, delegationDepth) {
  return { version: 0, cwd, isSeeded: false, delegationDepth };
}

function route() {
  return { config: { provider: "deepseek-official", model: "deepseek-v4-pro" } };
}

/** DSH 0.1.0-rc.x / 0.1.1-rc.x：日志是 `session.events`。 */
function legacySession({ id = "session-legacy-1", title, reply, delegationDepth = 0 } = {}) {
  return {
    id,
    header: header("/tmp/example-project", delegationDepth),
    events: logOf(title, reply),
    requestHeader: route,
  };
}

/** DSH 0.1.2-rc.1 起：没有 `events`，只有 `snapshotEvents()` / `ownEvents()`。 */
function modernSession({ id = "session-modern-1", title, reply, delegationDepth = 0 } = {}) {
  const events = logOf(title, reply);
  return {
    id,
    header: header("/tmp/example-project", delegationDepth),
    snapshotEvents: () => events,
    ownEvents: () => events,
    eventAt: (seq) => events.find((event) => event.seq === seq),
    requestHeader: route,
    requestContext: () => ({ provider: "deepseek-official", model: "deepseek-v4-pro" }),
  };
}

// 场景 1：旧版会话形状 + 不带通道号的 key → 通用域名；验证默认过滤
// （子代理不推、非 turn/end 不推、interrupted 不推）
const root1 = new Context();
await root1.plugin(plugin, {
  sendkey: "SMOKE-TEST-FAKE-KEY",
  reasons: ["completed", "blocked", "error", "max-tokens", "aborted"],
  notifySubagents: false,
});
root1.emit("session/event", legacySession({ title: "旧版会话标题", reply: "旧版回复正文" }), TURN_END);
root1.emit(
  "session/event",
  legacySession({ id: "session-legacy-sub", title: "旧版子代理标题", reply: "子代理回复", delegationDepth: 1 }),
  TURN_END,
);
root1.emit(
  "session/event",
  legacySession({ id: "session-legacy-step", title: "非回合结束不应推送", reply: "x" }),
  { type: "step/end", data: { turn: 1, step: 1 } },
);
root1.emit(
  "session/event",
  legacySession({ id: "session-legacy-interrupted", title: "中断回合不应推送", reply: "x" }),
  { type: "turn/end", data: { turn: 2, reason: { kind: "interrupted" } } },
);

// 场景 2：新版会话形状（无 `events`）+ 带通道号的 key → 专属 push 域名；
// notifySubagents: true 时子代理也推
const root2 = new Context();
await root2.plugin(plugin, {
  sendkey: "sctp1234t-FAKE-TEST-KEY-NOT-REAL",
  notifySubagents: true,
});
root2.emit("session/event", modernSession({ title: "新版会话标题", reply: "新版回复正文" }), TURN_END);
root2.emit(
  "session/event",
  modernSession({ id: "session-modern-sub", title: "新版子代理标题", reply: "子代理回复", delegationDepth: 1 }),
  TURN_END,
);

// 等待异步 deliver 完成
await new Promise((resolve) => setTimeout(resolve, 1500));

function assert(condition, message) {
  if (condition) return;
  console.error(`✘ ${message}`);
  process.exitCode = 1;
}

const generic = pushes.filter((p) => p.url.startsWith("https://sctapi.ftqq.com/"));
const ft07 = pushes.filter((p) => p.url.startsWith("https://1234.push.ft07.com/"));
const titles = pushes.map((p) => p.title ?? "");
const desps = pushes.map((p) => p.desp ?? "");

assert(pushes.length === 3, `预期 3 次推送（1 通用域名 + 2 专属域名），实际 ${pushes.length} 次`);
assert(
  generic.length === 1 && generic[0].url === "https://sctapi.ftqq.com/SMOKE-TEST-FAKE-KEY.send",
  "通用域名 URL 推导错误",
);
assert(ft07.length === 2, `专属域名分支预期 2 次推送（顶层 + 子代理），实际 ${ft07.length} 次`);
assert(
  ft07.every((p) => p.url === "https://1234.push.ft07.com/send/sctp1234t-FAKE-TEST-KEY-NOT-REAL.send"),
  "专属 push 域名 URL 推导错误",
);

// 正文与标题提取：两种会话形状都必须成功（旧版读 session.events，新版读 snapshotEvents()）
assert(desps.some((d) => d.includes("旧版回复正文")), "旧版会话形状未能提取 assistant 回复正文");
assert(titles.some((t) => t.includes("旧版会话标题")), "旧版会话形状未能提取对话标题");
assert(
  desps.some((d) => d.includes("新版回复正文")),
  "新版会话形状（无 session.events）未能提取 assistant 回复正文 —— 插件在新版 harness 上不会发送通知",
);
assert(titles.some((t) => t.includes("新版会话标题")), "新版会话形状未能提取对话标题");

assert(titles.some((t) => t.includes("新版子代理标题")), "notifySubagents: true 时子代理未推送");
assert(!titles.some((t) => t.includes("旧版子代理标题")), "notifySubagents: false 时子代理不应推送");
assert(!titles.some((t) => t.includes("非回合结束不应推送")), "非 turn/end 事件不应推送");
assert(!titles.some((t) => t.includes("中断回合不应推送")), "interrupted 回合不应推送");

if (process.exitCode) {
  console.error("冒烟测试失败，捕获到的推送：");
  for (const push of pushes) console.error("  ", push.url, "|", push.title);
  process.exit(process.exitCode);
}

console.log(
  "✔ 全部断言通过：新旧两种会话形状、URL 双分支推导、子代理过滤、interrupted 忽略、notifySubagents 开关",
);
if (process.env.REPORT === "1") {
  for (const push of pushes) {
    console.log("\n===== 推送 =====");
    console.log("  URL:", push.url);
    console.log("  title:", push.title);
    console.log("  desp:\n" + push.desp);
  }
}
process.exit(0);
