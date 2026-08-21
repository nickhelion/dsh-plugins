/**
 * dsh-serverchan-notify — 每当 DeepSeek Harness 完成一个回答回合（turn/end），
 * 向 Server酱3 (ServerChan³) 推送一条 Markdown 通知。
 *
 * 行为对齐 codex 的 Stop hook：一次用户请求结束
 * （无论 completed / error / blocked / max-tokens / aborted）就发一条，
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

/** 取最近一条 assistant/message 里的文本块（跳过只有工具调用的中间步骤）。 */
function lastAssistantText(session) {
  const events = session.events;
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
function sessionTitle(session) {
  const events = session.events;
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

/** 构建并推送一条通知；任何失败只记日志，绝不向上抛。 */
async function deliver(ctx, options, sendkey, session, event, reasonKind) {
  try {
    const cwd = session.header?.cwd ?? "";
    const branch = await gitBranch(cwd);
    let response = lastAssistantText(session);
    const truncated = response.length > options.maxResponseChars;
    if (truncated) {
      response = `${response.slice(0, options.maxResponseChars).trimEnd()}\n\n> 回复过长，已截断`;
    }
    const title = sessionTitle(session);
    const reasonLabel = REASON_LABELS[reasonKind] ?? String(reasonKind);
    const details = [
      `- **对话标题**：${title}`,
      `- **模型**：${modelLabel(session)}`,
      `- **项目目录**：\`${cwd || "未知"}\``,
      ...(branch ? [`- **Git 分支**：\`${branch}\``] : []),
      `- **回合状态**：${reasonLabel}`,
      `- **完成时间**：${new Date().toISOString()}`,
      `- **会话 ID**：\`${String(session.id)}\``,
      "---",
      "## DSH 最新回复",
      response || `（本次回合未产生文本回复：${reasonLabel}）`,
    ];
    const pushTitle = `DSH 完成：${title}`.replace(/\s+/g, " ").slice(0, 120);
    const response_ = await fetch(serverchanUrl(sendkey), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // Server酱 边缘节点会拒掉 Node 默认的 fetch UA。
        "User-Agent": "DSH-ServerChan-Notify/1.0 curl-compatible",
      },
      body: new URLSearchParams({ title: pushTitle, desp: details.join("\n\n") }),
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

/**
 * cordis 插件入口。挂载后订阅 session 事件流水线，
 * 在顶层会话（默认跳过子代理会话，避免被内部子任务刷屏）的每个回合结束时推送。
 *
 * @param {object} ctx   cordis 上下文
 * @param {object} config 加载器注入的配置（来自 cordis.patch.yml 的行配置）
 */
export default function serverchanNotify(ctx, config = {}) {
  const options = {
    sendkey: config.sendkey,
    sendkeyFile: config.sendkeyFile,
    reasons: config.reasons ?? DEFAULT_REASONS,
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
    if (event.type !== "turn/end") return;
    const reasonKind = event.data?.reason?.kind;
    if (!Array.isArray(options.reasons) || !options.reasons.includes(reasonKind)) return;
    const depth = session.header?.delegationDepth ?? 0;
    if (!options.notifySubagents && depth > 0) return;
    // fire-and-forget：通知绝不阻塞 agent 主循环
    void deliver(ctx, options, sendkey, session, event, reasonKind);
  });

  ctx.logger.info("serverchan-notify: 已启用，回合结束时将向 Server酱3 推送通知");
}
