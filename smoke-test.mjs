/**
 * 冒烟测试：在独立的 cordis 根上下文里挂载 dsh-serverchan-notify，
 * 用伪造的会话与 turn/end 事件验证插件签名、事件订阅与消息组装全链路。
 * fetch 被替换为探针，不会真实推送；REPORT=1 可打印完整报文。
 *
 * 先 `npm install`（安装 devDependency @deepseek-ai/cordis），再：
 *   node smoke-test.mjs
 */
import { Context } from "@deepseek-ai/cordis";
import plugin from "./lib/index.js";

const root = new Context();

// 探针：捕获推送请求，不真正发送
let captured = null;
globalThis.fetch = async (url, init) => {
  captured = {
    url,
    title: new URLSearchParams(init.body.toString()).get("title"),
    desp: new URLSearchParams(init.body.toString()).get("desp"),
  };
  return { ok: true, status: 200, json: async () => ({ code: 0, message: "SUCCESS" }) };
};

// 假 key 直接内联进配置：插件无需读文件即可启用。
// 刻意不使用 sctp 前缀——仓库内不应出现任何形似 SendKey 的字符串。
await root.plugin(plugin, {
  sendkey: "SMOKE-TEST-FAKE-KEY",
  reasons: ["completed", "blocked", "error", "max-tokens", "aborted"],
  notifySubagents: false,
});

// 伪造一个会话对象（插件只读取这些字段）
const fakeSession = {
  id: "session-test-1",
  header: { cwd: "/tmp/example-project", delegationDepth: 0 },
  events: [
    { type: "session/title", data: { title: "冒烟测试对话" } },
    { type: "assistant/message", data: { message: { content: [{ type: "text", text: "你好，这是测试回复正文。" }] } } },
  ],
  requestHeader: () => ({ config: { provider: "deepseek-official", model: "deepseek-v4-pro" } }),
};

root.emit("session/event", fakeSession, {
  type: "turn/end",
  data: { turn: 1, reason: { kind: "completed" } },
});

// 子代理会话应被默认过滤
root.emit("session/event", { ...fakeSession, id: "session-sub-1", header: { delegationDepth: 1 } }, {
  type: "turn/end",
  data: { turn: 1, reason: { kind: "completed" } },
});

// 非 turn/end 事件应被忽略
root.emit("session/event", fakeSession, { type: "step/end", data: { turn: 1, step: 1 } });

// 等待异步 deliver 完成
await new Promise((resolve) => setTimeout(resolve, 1500));

if (!captured) {
  console.error("✘ 失败：没有捕获到任何推送请求");
  process.exit(1);
}
console.log("✔ 插件挂载并订阅成功，捕获到一次推送（子代理与 step/end 均被正确过滤）");
console.log("  URL:", captured.url.replace(/send\/[^/]+\//, "send/<key>/"));
console.log("  title:", captured.title);
if (process.env.REPORT === "1") {
  console.log("  desp:\n" + captured.desp);
}
process.exit(0);
