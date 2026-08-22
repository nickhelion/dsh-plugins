/** Qwen Responses API 服务端内置工具（不是 DSH 本地函数工具）。 */
export const HARNESS_TOOL_TYPES = Object.freeze([
  "web_search",
  "code_interpreter",
  "web_extractor",
  "web_search_image",
  "image_search",
]);

export const HARNESS_TOOL_LABELS = Object.freeze({
  web_search: "联网搜索",
  code_interpreter: "代码解释器",
  web_extractor: "网页抓取",
  // Responses schema: web_search_image 接收 queries（文搜图）；
  // image_search 接收输入图片索引与 bbox（以图搜图）。
  web_search_image: "文搜图",
  image_search: "以图搜图",
});

/** 单条服务端工具活动的 emoji 徽标，与中文粗体标签联合渲染为可扫描标题行。 */
const HARNESS_TOOL_BADGES = Object.freeze({
  web_search: "🔎",
  code_interpreter: "🧮",
  web_extractor: "📄",
  web_search_image: "🔍",
  image_search: "🖼️",
});

/** 统一标题行：`**{emoji} {中文标签}（千问内置）**`，明确来源为服务端内置工具。 */
function badgeLabel(type, fallbackType) {
  const emoji = HARNESS_TOOL_BADGES[type] ?? "⚙️";
  const label = HARNESS_TOOL_LABELS[type] ?? fallbackType ?? type ?? "未知工具";
  return `**${emoji} ${label}（千问内置）**`;
}

const KNOWN = new Set(HARNESS_TOOL_TYPES);

/** 将插件配置归一化为 auto / none / 显式列表。 */
export function normalizeHarnessMode(value) {
  if (value == null || value === "" || value === "auto") return { mode: "auto" };
  if (value === false || value === "none") return { mode: "none" };
  const raw = Array.isArray(value) ? value : String(value).split(",");
  const tools = raw.map((item) => String(item).trim()).filter((item) => KNOWN.has(item));
  return tools.length === 0 ? { mode: "none" } : { mode: "list", tools };
}

/**
 * 取配置与模型官方能力的交集，并满足 web_extractor 必须和 web_search 一起声明的约束。
 */
export function selectHarnessTools(supported, mode) {
  const available = new Set(supported.filter((item) => KNOWN.has(item)));
  if (mode.mode === "none") return [];
  const selected = mode.mode === "auto"
    ? new Set(available)
    : new Set(mode.tools.filter((item) => available.has(item)));
  if (selected.has("web_extractor") && available.has("web_search")) {
    selected.add("web_search");
  }
  return HARNESS_TOOL_TYPES.filter((item) => selected.has(item));
}

function clip(value, max = 600) {
  const text = String(value ?? "").trim();
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

function stringArray(value) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

/**
 * 将单条服务端工具活动（一次 output_item）渲染为独立、自解释、可在 DSH UI 看见的简洁 Markdown。
 * 只保留理解回答出处所需的字段，均经长度限制；不暗示拿到服务端未返回的正文或内部结果。
 */
export function formatHarnessEntry(entry) {
  const data = entry?.data && typeof entry.data === "object" ? entry.data : {};
  const action = data.action && typeof data.action === "object" ? data.action : {};
  switch (entry?.type) {
    case "web_search_call": {
      const queries = stringArray(action.queries);
      const sources = Array.isArray(action.sources) ? action.sources : [];
      const urls = sources
        .map((source) => source && typeof source === "object" ? String(source.url ?? "") : "")
        .filter(Boolean);
      const lines = [`${badgeLabel("web_search")}${queries.length ? ` · ${queries.map((q) => clip(q, 120)).join("、")}` : ""}`];
      if (urls.length) lines.push(...urls.map((url) => `- ${clip(url, 300)}`));
      return lines.join("\n");
    }
    case "code_interpreter_call": {
      const lines = [`${badgeLabel("code_interpreter")} · 已执行`];
      if (typeof data.code === "string" && data.code.trim()) lines.push(`\`\`\`python\n${clip(data.code)}\n\`\`\``);
      const logs = (Array.isArray(data.outputs) ? data.outputs : [])
        .filter((item) => item && typeof item === "object" && item.type === "logs")
        .map((item) => clip(item.logs))
        .filter(Boolean);
      if (logs.length) lines.push(...logs);
      return lines.join("\n");
    }
    case "web_extractor_call": {
      const lines = [`${badgeLabel("web_extractor")}${data.goal ? ` · ${clip(data.goal, 200)}` : ""}`];
      lines.push(...stringArray(data.urls).map((url) => `- ${clip(url, 300)}`));
      return lines.join("\n");
    }
    case "web_search_image_call":
    case "image_search_call": {
      const label = entry.type === "web_search_image_call" ? "🔍 文搜图" : "🖼️ 以图搜图";
      const isError = data.error != null && String(data.error).trim() !== "";
      let count;
      let output = data.output;
      if (typeof output === "string") {
        try { output = JSON.parse(output); } catch { /* 只影响显示计数 */ }
      }
      if (Array.isArray(output)) count = output.length;
      else if (output && typeof output === "object" && Array.isArray(output.images)) count = output.images.length;
      const suffix = isError ? " · 调用失败" : count == null ? " · 已调用" : ` · 返回 ${count} 张图片`;
      return `**${label}（千问内置）**${suffix}`;
    }
    default:
      return `${badgeLabel(undefined, String(entry?.type ?? "未知"))} · 已调用`;
  }
}

/** 将服务端工具活动渲染为可持久化、可在 DSH UI 看见的简洁 Markdown（流末兜底聚合形式）。 */
export function formatHarnessActivity(activity) {
  if (!Array.isArray(activity) || activity.length === 0) return "";
  const parts = activity.map((entry) => formatHarnessEntry(entry)).filter(Boolean);
  return `\n\n---\n${parts.join("\n\n")}`;
}

export function describeHarnessTools(tools) {
  if (!tools?.length) return "官方未列出服务端内置工具（DSH 本地工具仍可用）";
  return tools.map((tool) => HARNESS_TOOL_LABELS[tool] ?? tool).join("、");
}
