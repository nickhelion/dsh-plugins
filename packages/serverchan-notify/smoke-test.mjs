/**
 * 冒烟测试：在独立的 cordis 根上下文里挂载 dsh-serverchan-notify，
 * 覆盖两条 URL 推导分支、回合过滤规则、提问提醒与子代理开关。
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

/** ask_user_question 的 tool/call 事件（`arguments` 是模型产出的未解析 JSON 字符串）。 */
function questionCall(questions) {
  return {
    type: "tool/call",
    data: { turn: 1, step: 1, callId: "call-ask-1", name: "ask_user_question", arguments: JSON.stringify({ questions }) },
  };
}

/** 非提问工具的 tool/call —— 不应触发任何推送。 */
const BASH_CALL = {
  type: "tool/call",
  data: { turn: 1, step: 1, callId: "call-bash-1", name: "bash", arguments: '{"command":"ls"}' },
};

const ASK_QUESTIONS = [
  {
    id: "mode",
    header: "选择模式",
    question: "要按哪条路径继续？",
    options: [
      { label: "直接改（推荐）", description: "小步快跑" },
      { label: "先出方案", description: "多一轮评审" },
    ],
  },
  {
    id: "scope",
    question: "改动范围包含哪些？",
    multi_select: true,
    options: [{ label: "README" }, { label: "测试" }],
  },
];

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
// （子代理不推、非 turn/end 不推、interrupted 不推、非提问工具不推）
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
root1.emit(
  "session/event",
  legacySession({ id: "session-legacy-ask", title: "旧版提问标题", reply: "?" }),
  questionCall(ASK_QUESTIONS),
);
root1.emit("session/event", legacySession({ id: "session-legacy-bash", title: "非提问工具不应推送", reply: "x" }), BASH_CALL);
root1.emit(
  "session/event",
  legacySession({
    id: "session-legacy-ask-sub",
    title: "子代理提问不应推送",
    reply: "?",
    delegationDepth: 1,
  }),
  questionCall(ASK_QUESTIONS),
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
root2.emit(
  "session/event",
  modernSession({ id: "session-modern-ask", title: "新版提问标题", reply: "?" }),
  questionCall(ASK_QUESTIONS),
);
root2.emit(
  "session/event",
  modernSession({ id: "session-modern-ask-sub", title: "新版子代理提问标题", reply: "?", delegationDepth: 1 }),
  questionCall(ASK_QUESTIONS),
);
// 损坏的 arguments：仍应提醒，只是内容降级
root2.emit(
  "session/event",
  modernSession({ id: "session-modern-ask-broken", title: "参数损坏提问标题", reply: "?" }),
  { type: "tool/call", data: { turn: 1, step: 1, callId: "call-ask-2", name: "ask_user_question", arguments: "{not json" } },
);

// 场景 3：notifyQuestions: false 时提问不推送，回合结束仍然推
const root3 = new Context();
await root3.plugin(plugin, {
  sendkey: "SMOKE-TEST-FAKE-KEY",
  notifyQuestions: false,
});
root3.emit(
  "session/event",
  legacySession({ id: "session-no-question-push", title: "关闭提问提醒的会话", reply: "?" }),
  questionCall(ASK_QUESTIONS),
);
root3.emit("session/event", legacySession({ id: "session-turn-only", title: "关闭提问提醒仍推回合", reply: "仍应推送" }), TURN_END);

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
const askTitles = titles.filter((t) => t.startsWith("DSH 提问："));
const askDesps = pushes.filter((p) => (p.title ?? "").startsWith("DSH 提问："));

// 2 通用域名（回合 + 提问）+ 1 关闭提问提醒后的回合 = 3
assert(generic.length === 3, `通用域名预期 3 次推送，实际 ${generic.length} 次`);
assert(
  generic.every((p) => p.url === "https://sctapi.ftqq.com/SMOKE-TEST-FAKE-KEY.send"),
  "通用域名 URL 推导错误",
);
// 2 回合（顶层 + 子代理）+ 3 提问（顶层 + 子代理 + 参数损坏）= 5
assert(ft07.length === 5, `专属域名分支预期 5 次推送，实际 ${ft07.length} 次`);
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

// 提问提醒：ask_user_question 要推，且带上问题正文与选项
assert(
  askTitles.length === 4,
  `预期 4 条提问提醒（旧版顶层 + 新版顶层/子代理 + 参数损坏），实际 ${askTitles.length} 条`,
);
assert(titles.some((t) => t.includes("旧版提问标题")), "ask_user_question 未触发提问提醒");
assert(titles.some((t) => t.includes("新版提问标题")), "新版会话形状未能触发提问提醒");
assert(titles.some((t) => t.includes("新版子代理提问标题")), "notifySubagents: true 时子代理提问未推送");
assert(!titles.some((t) => t.includes("子代理提问不应推送")), "notifySubagents: false 时子代理提问不应推送");
assert(!titles.some((t) => t.includes("非提问工具不应推送")), "非 ask_user_question 的 tool/call 不应推送");
assert(!titles.some((t) => t.includes("关闭提问提醒的会话")), "notifyQuestions: false 时提问不应推送");
assert(titles.some((t) => t.includes("关闭提问提醒仍推回合")), "notifyQuestions: false 不应影响回合结束推送");

const askDesp = askDesps.find((p) => (p.title ?? "").includes("旧版提问标题"))?.desp ?? "";
assert(askDesp.includes("要按哪条路径继续？"), "提问提醒未包含问题正文");
assert(askDesp.includes("选择模式"), "提问提醒未包含问题 header");
assert(askDesp.includes("直接改（推荐）"), "提问提醒未包含选项 label");
assert(askDesp.includes("小步快跑"), "提问提醒未包含选项 description");
assert(askDesp.includes("该问题可多选"), "提问提醒未标注多选问题");
assert(askDesp.includes("DSH 正在等待你的回答"), "提问提醒缺少等待回答的小标题");
assert(!askDesp.includes("DSH 最新回复"), "提问提醒不应包含回合回复段落");
const brokenDesp = askDesps.find((p) => (p.title ?? "").includes("参数损坏提问标题"))?.desp ?? "";
assert(brokenDesp.includes("无法解析本次提问内容"), "arguments 损坏时提问提醒未降级");

if (process.exitCode) {
  console.error("冒烟测试失败，捕获到的推送：");
  for (const push of pushes) console.error("  ", push.url, "|", push.title);
  process.exit(process.exitCode);
}

console.log(
  "✔ 全部断言通过：新旧两种会话形状、URL 双分支推导、子代理过滤、interrupted 忽略、" +
    "notifySubagents 开关、ask_user_question 提问提醒与 notifyQuestions 开关",
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
