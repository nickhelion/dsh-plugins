/**
 * dsh-serverchan-notify — 在两种时机向 Server酱3 (ServerChan³) 推送一条
 * Markdown 通知：
 *   1. 完成一个回答回合（turn/end）—— 对齐 codex 的 Stop hook：一次用户请求
 *      结束（无论 completed / error / blocked / max-tokens / aborted）就发一条；
 *   2. agent 调用 ask_user_question 提问时（tool/call）—— agent 此刻正阻塞
 *      等人回答，人不在电脑前就会一直卡住，所以提问与回合结束同等重要。
 *
 * 通知失败绝不影响 harness 主流程。
 *
 * SendKey 通过环境变量 / 文件 / 插件配置提供，仓库内不含任何 key。
 * 挂载方式（全局）：$DSH_HOME/cordis.patch.yml 中 insert 一行本插件。
 */
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const name = "dsh-serverchan-notify";

/** 默认在这些回合结束原因下推送（interrupted 是崩溃恢复标记，不推）。 */
const DEFAULT_REASONS = ["completed", "blocked", "error", "max-tokens", "aborted"];
const DEFAULT_MAX_RESPONSE_CHARS = 16_000;
const DEFAULT_TIMEOUT_MS = 8_000;

/**
 * 触发「提问提醒」的工具名。这是 dsh-tool-ask-user 注册的模型侧工具名，
 * 也就是调用 ctx.userQuestions.ask() 阻塞等待人类回答的唯一入口。
 */
const QUESTION_TOOL_NAME = "ask_user_question";

/** 回合结束原因 → 中文状态标签。 */
const REASON_LABELS = {
  completed: "完成",
  blocked: "阻塞",
  error: "出错",
  "max-tokens": "超出输出上限",
  aborted: "中断",
};

/**
 * 解析 SendKey，按优先级取第一个非空值：
 *   1. 环境变量 SERVERCHAN_SENDKEY
 *   2. 配置内联 config.sendkey
 *   3. 环境变量 SERVERCHAN_SENDKEY_FILE 指定的文件
 *   4. 配置 config.sendkeyFile 指定的文件（支持 ~ 开头）
 *   5. 默认文件 $DSH_HOME/secrets/serverchan_sendkey（~/.dsh/secrets/serverchan_sendkey）
 *
 * 仓库内不含任何 key；本机配置见 README「配置 SendKey」。
 */
function dshHome() {
  return process.env.DSH_HOME || join(homedir(), ".dsh");
}

function readKeyFile(file) {
  if (!file) return "";
  const expanded = file.startsWith("~/") ? join(homedir(), file.slice(2)) : file;
  if (!existsSync(expanded)) return "";
  try {
    return readFileSync(expanded, "utf-8").trim();
  } catch {
    return "";
  }
}

function loadSendkey(config) {
  const candidates = [
    process.env.SERVERCHAN_SENDKEY,
    config.sendkey ? String(config.sendkey).trim() : "",
    readKeyFile(process.env.SERVERCHAN_SENDKEY_FILE),
    readKeyFile(config.sendkeyFile),
    readKeyFile(join(dshHome(), "secrets", "serverchan_sendkey")),
  ];
  for (const key of candidates) {
    if (key) return key;
  }
  return "";
}

/** Server酱3 key 带通道 id（sctp<N>t...）时走专属 push 域名，否则走通用域名。 */
function serverchanUrl(sendkey) {
  const match = /^sctp(\d+)t/.exec(sendkey);
  if (match) return `https://${match[1]}.push.ft07.com/send/${sendkey}.send`;
  return `https://sctapi.ftqq.com/${sendkey}.send`;
}

/**
 * 读取会话日志（按发生顺序，旧 → 新）。
 *
 * DSH 0.1.2-rc.1 移除了 `Session.events` getter：新版会话类改用
 * `snapshotEvents()`（另有只含本会话自有事件的 `ownEvents()`），
 * 而 0.1.0-rc.x / 0.1.1-rc.x 只有 `events`。两条 API 线都要能读，
 * 否则新版 harness 上会静默取到 undefined。
 *
 * 读日志本身失败时按“空日志”处理：取不到正文只该让通知内容降级，
 * 绝不允许把异常抛给 harness。
 */
function sessionEvents(session) {
  try {
    if (typeof session.snapshotEvents === "function") return session.snapshotEvents();
    if (Array.isArray(session.events)) return session.events;
  } catch {
    // 落到空日志
  }
  return [];
}

/** 取最近一条 assistant/message 里的文本块（跳过只有工具调用的中间步骤）。 */
function lastAssistantText(events) {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.type !== "assistant/message") continue;
    const parts = [];
    for (const block of event.data.message.content ?? []) {
      if (block.type === "text" && typeof block.text === "string" && block.text.trim()) {
        parts.push(block.text);
      }
    }
    if (parts.length > 0) return parts.join("\n\n");
  }
  return "";
}

/** 取最近的 session/title 事件作为对话标题。 */
function sessionTitle(events) {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.type !== "session/title") continue;
    const title = event.data?.title;
    if (typeof title === "string" && title.trim()) return title.trim();
  }
  return "DeepSeek Harness 任务";
}

/** 从 request/header 折叠里取当前模型路由。 */
function modelLabel(session) {
  try {
    const config = session.requestHeader()?.config;
    if (config?.provider && config?.model) return `${config.provider} / ${config.model}`;
  } catch {
    // 折叠失败就退回未知
  }
  return "未知模型";
}

/** 项目目录的当前 git 分支（拿不到就省略该行）。 */
async function gitBranch(cwd) {
  if (!cwd) return "";
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", cwd, "branch", "--show-current"],
      { timeout: 2_000 },
    );
    return stdout.trim();
  } catch {
    return "";
  }
}

/**
 * 两种通知共用的上下文表头：对话标题、模型、目录、分支、（可选状态行）、
 * 时间戳、会话 ID。`statusLine` 为空时该行整行省略。
 */
async function contextLines(session, events, statusLine, timeLabel) {
  const cwd = session.header?.cwd ?? "";
  const branch = await gitBranch(cwd);
  return [
    `- **对话标题**：${sessionTitle(events)}`,
    `- **模型**：${modelLabel(session)}`,
    `- **项目目录**：\`${cwd || "未知"}\``,
    ...(branch ? [`- **Git 分支**：\`${branch}\``] : []),
    ...(statusLine ? [statusLine] : []),
    `- **${timeLabel}**：${new Date().toISOString()}`,
    `- **会话 ID**：\`${String(session.id)}\``,
  ];
}

/** 按上限截断正文并附一行截断说明。 */
function truncateBody(body, maxChars) {
  if (body.length <= maxChars) return body;
  return `${body.slice(0, maxChars).trimEnd()}\n\n> 内容过长，已截断`;
}

/** 组装并推送一条通知；任何失败只记日志，绝不向上抛。 */
async function push(ctx, options, sendkey, title, desp) {
  try {
    const response_ = await fetch(serverchanUrl(sendkey), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // Server酱 边缘节点会拒掉 Node 默认的 fetch UA。
        "User-Agent": "DSH-ServerChan-Notify/1.0 curl-compatible",
      },
      body: new URLSearchParams({ title, desp }),
      signal: AbortSignal.timeout(options.timeoutMs),
    });
    if (!response_.ok) throw new Error(`HTTP ${response_.status}`);
    const result = await response_.json();
    if (result?.code !== 0) {
      throw new Error(`Server酱拒绝推送：code=${result?.code} message=${result?.message ?? ""}`);
    }
  } catch (error) {
    ctx.logger.warn(
      `serverchan-notify: 通知发送失败：${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** 组装并推送「回合结束」通知；任何失败只记日志，绝不向上抛。 */
async function deliver(ctx, options, sendkey, session, reasonKind) {
  try {
    const events = sessionEvents(session);
    const response = lastAssistantText(events);
    const reasonLabel = REASON_LABELS[reasonKind] ?? String(reasonKind);
    const details = [
      ...(await contextLines(session, events, `- **回合状态**：${reasonLabel}`, "完成时间")),
      "---",
      "## DSH 最新回复",
      truncateBody(response, options.maxResponseChars) ||
        `（本次回合未产生文本回复：${reasonLabel}）`,
    ];
    const pushTitle = `DSH 完成：${sessionTitle(events)}`.replace(/\s+/g, " ").slice(0, 120);
    await push(ctx, options, sendkey, pushTitle, details.join("\n\n"));
  } catch (error) {
    ctx.logger.warn(
      `serverchan-notify: 通知发送失败：${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * 从 ask_user_question 的原始 arguments 里取出问题数组。
 *
 * `tool/call` 事件里的 `arguments` 是模型产出的未解析 JSON 字符串，可能损坏。
 * 解析失败按「没有结构」处理并让内容降级，绝不抛异常。
 */
function askUserQuestions(event) {
  const raw = event.data?.arguments;
  if (typeof raw !== "string" || !raw.trim()) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const questions = parsed?.questions;
  if (!Array.isArray(questions)) return [];
  return questions.filter((question) => question && typeof question === "object");
}

/** 把一个问题渲染成 Markdown 片段（标题、正文、选项、多选提示）。 */
function renderQuestion(question, index) {
  const header = typeof question.header === "string" ? question.header.trim() : "";
  const text = typeof question.question === "string" ? question.question.trim() : "";
  const lines = [`### ${index + 1}. ${header || text || "未命名问题"}`];
  if (header && text) lines.push(text);
  for (const option of Array.isArray(question.options) ? question.options : []) {
    const label = typeof option?.label === "string" ? option.label.trim() : "";
    if (!label) continue;
    const description =
      typeof option?.description === "string" && option.description.trim()
        ? ` — ${option.description.trim()}`
        : "";
    lines.push(`- ${label}${description}`);
  }
  if (question.multi_select === true) lines.push("> 该问题可多选");
  return lines.join("\n");
}

/** 组装并推送「agent 提问」通知；任何失败只记日志，绝不向上抛。 */
async function deliverQuestion(ctx, options, sendkey, session, event) {
  try {
    const events = sessionEvents(session);
    const questions = askUserQuestions(event);
    const body = questions.length
      ? questions.map(renderQuestion).join("\n\n")
      : "> 无法解析本次提问内容，请回到 DSH 查看。";
    const details = [
      ...(await contextLines(session, events, "", "提问时间")),
      "---",
      "## DSH 正在等待你的回答",
      truncateBody(body, options.maxResponseChars),
    ];
    const pushTitle = `DSH 提问：${sessionTitle(events)}`.replace(/\s+/g, " ").slice(0, 120);
    await push(ctx, options, sendkey, pushTitle, details.join("\n\n"));
  } catch (error) {
    ctx.logger.warn(
      `serverchan-notify: 提问通知发送失败：${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * cordis 插件入口。挂载后订阅 session 事件流水线，在顶层会话
 * （默认跳过子代理会话，避免被内部子任务刷屏）里推送两类通知：
 *   - 每个回合结束（可经 `reasons` 裁剪）；
 *   - agent 调用 `ask_user_question` 提问时（`notifyQuestions: false` 可关）。
 *
 * @param {object} ctx   cordis 上下文
 * @param {object} config 加载器注入的配置（来自 cordis.patch.yml 的行配置）
 */
export default function serverchanNotify(ctx, config = {}) {
  const options = {
    sendkey: config.sendkey,
    sendkeyFile: config.sendkeyFile,
    reasons: config.reasons ?? DEFAULT_REASONS,
    notifyQuestions: config.notifyQuestions ?? true,
    notifySubagents: config.notifySubagents ?? false,
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxResponseChars: config.maxResponseChars ?? DEFAULT_MAX_RESPONSE_CHARS,
    disabled: config.disabled ?? false,
  };
  if (options.disabled) return;

  const sendkey = loadSendkey(options);
  if (!sendkey) {
    ctx.logger.warn("serverchan-notify: 未找到 Server酱 SendKey，通知功能未启用");
    return;
  }

  ctx.on("session/event", (session, event) => {
    const depth = session.header?.delegationDepth ?? 0;
    if (!options.notifySubagents && depth > 0) return;

    // agent 提问：此刻它正阻塞等人回答，立刻提醒。
    if (event.type === "tool/call") {
      if (!options.notifyQuestions) return;
      if (event.data?.name !== QUESTION_TOOL_NAME) return;
      // fire-and-forget：通知绝不阻塞 agent 主循环
      void deliverQuestion(ctx, options, sendkey, session, event);
      return;
    }

    if (event.type !== "turn/end") return;
    const reasonKind = event.data?.reason?.kind;
    if (!Array.isArray(options.reasons) || !options.reasons.includes(reasonKind)) return;
    // fire-and-forget：通知绝不阻塞 agent 主循环
    void deliver(ctx, options, sendkey, session, reasonKind);
  });

  ctx.logger.info(
    "serverchan-notify: 已启用，回合结束与 agent 提问时将向 Server酱3 推送通知",
  );
}
