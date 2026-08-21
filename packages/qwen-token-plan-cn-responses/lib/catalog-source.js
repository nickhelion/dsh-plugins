import { createHash } from "node:crypto";
import { HARNESS_TOOL_TYPES } from "./harness.js";

export const OFFICIAL_DOC_URLS = Object.freeze({
  personal: "https://platform.qianwenai.com/docs/token-plan/personal/token-plan-personal-overview.md",
  tools: "https://platform.qianwenai.com/docs/token-plan/best-practices/built-in-tools.md",
  openclaw: "https://platform.qianwenai.com/docs/developer-guides/clients-and-developer-tools/openclaw.md",
  responses: "https://platform.qianwenai.com/docs/api-reference/chat/openai-responses.md",
  chat: "https://platform.qianwenai.com/docs/api-reference/chat/openai-chat.md",
});

const TOOL_FROM_CN = Object.freeze({
  联网搜索: "web_search",
  代码解释器: "code_interpreter",
  网页抓取: "web_extractor",
  以图搜图: "image_search",
  文搜图: "web_search_image",
});

const FALLBACK_METADATA = Object.freeze([
  { id: "qwen3.8-max", input: ["text", "image"], contextWindow: 983616, maxTokens: 131072 },
  { id: "qwen3.7-max", input: ["text"], contextWindow: 1000000, maxTokens: 65536 },
  { id: "qwen3.7-plus", input: ["text", "image"], contextWindow: 1000000, maxTokens: 65536 },
  { id: "qwen3.6-flash", input: ["text", "image"], contextWindow: 1000000, maxTokens: 32768 },
  { id: "glm-5.2", input: ["text"], contextWindow: 1000000, maxTokens: 16384 },
  { id: "deepseek-v4-pro", input: ["text"], contextWindow: 163840, maxTokens: 32768 },
  { id: "deepseek-v4-pro-0813", input: ["text"], contextWindow: 163840, maxTokens: 32768 },
  { id: "deepseek-v4-flash-0731", input: ["text"], contextWindow: 1000000, maxTokens: 393216 },
]);

function section(markdown, heading, nextHeadingLevel = "##") {
  const start = markdown.indexOf(heading);
  if (start < 0) throw new Error(`官方文档缺少章节：${heading}`);
  const rest = markdown.slice(start + heading.length);
  const matcher = new RegExp(`^${nextHeadingLevel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "m");
  const hit = matcher.exec(rest);
  return hit ? rest.slice(0, hit.index) : rest;
}

function tableRows(markdown) {
  const rows = [];
  for (const raw of markdown.split(/\r?\n/)) {
    if (!raw.trim().startsWith("|")) continue;
    const cells = raw.trim().slice(1, -1).split("|").map((cell) => cell.trim());
    if (cells.every((cell) => /^:?-+:?$/.test(cell.replace(/\s/g, "")))) continue;
    rows.push(cells);
  }
  return rows;
}

export function parsePersonalModels(markdown) {
  const rows = tableRows(section(markdown, "## 支持的模型"));
  const models = [];
  for (const cells of rows) {
    if (cells.length < 3 || /Model ID/i.test(cells[1])) continue;
    const id = cells[1].replace(/`/g, "").trim();
    const capabilities = cells[2];
    if (!id || !capabilities.includes("文本生成")) continue;
    models.push({ brand: cells[0], id, capabilities });
  }
  if (models.length < 2) throw new Error("个人版模型表解析结果异常");
  return models;
}

export function parseResponsesModels(markdown) {
  const marker = "description: 模型名称。支持的模型包括";
  const line = markdown.split(/\r?\n/).find((candidate) => candidate.includes(marker));
  if (!line) throw new Error("Responses API 文档缺少支持模型清单");
  const list = line.slice(line.indexOf(marker) + marker.length)
    .split(/[、，,。]/)
    .map((id) => id.replace(/[`。；;\s]/g, "").trim())
    .filter((id) => /^[A-Za-z0-9][A-Za-z0-9._-]+$/.test(id));
  if (list.length < 3) throw new Error("Responses API 支持模型清单解析结果异常");
  return new Set(list);
}

export function parseOpenClawMetadata(markdown) {
  const blocks = [...markdown.matchAll(/```json\s*\n([\s\S]*?)\n```/g)];
  for (const match of blocks) {
    let parsed;
    try { parsed = JSON.parse(match[1]); } catch { continue; }
    const models = parsed?.models?.providers?.["bailian-token-plan"]?.models;
    if (!Array.isArray(models)) continue;
    const result = new Map();
    for (const model of models) {
      if (!model || typeof model.id !== "string") continue;
      result.set(model.id, {
        reasoning: model.reasoning === true,
        input: Array.isArray(model.input) ? model.input.filter((item) => item === "text" || item === "image") : ["text"],
        contextWindow: Number.isFinite(model.contextWindow) ? model.contextWindow : undefined,
        maxTokens: Number.isFinite(model.maxTokens) ? model.maxTokens : undefined,
      });
    }
    if (result.size >= 2) return result;
  }
  throw new Error("OpenClaw 文档中未找到个人版模型参数块");
}

const EFFORT_IDS = new Set(["none", "minimal", "low", "medium", "high", "xhigh", "max"]);

function modelIds(text) {
  return [...text.matchAll(/(?:deepseek|glm)-[a-z0-9.-]+/gi)].map((match) => match[0].toLowerCase());
}

/** Parse model-specific reasoning-effort profiles from the official Chat API reference. */
export function parseReasoningProfiles(markdown) {
  const start = markdown.indexOf("reasoning_effort:");
  const end = markdown.indexOf("clear_thinking:", start + 1);
  if (start < 0 || end < 0) throw new Error("Chat API 文档缺少 reasoning_effort 参数说明");
  const lines = markdown.slice(start, end).split(/\r?\n/);
  const result = new Map();

  for (const line of lines) {
    if (/Qwen3\.8-Max/i.test(line) && /可选值/.test(line)) {
      result.set("qwen3.8-max", { efforts: ["low", "medium", "xhigh"], defaultEffort: "xhigh" });
      continue;
    }
    if (/DeepSeek-V4 与 GLM 系列/i.test(line) && /适用于/.test(line)) {
      for (const id of modelIds(line)) result.set(id, { efforts: ["high", "max"], defaultEffort: "high" });
      continue;
    }
    if (/deepseek-v4-flash-0731/i.test(line) && /deepseek-v4-pro-0813/i.test(line) && /可选值/.test(line)) {
      for (const id of modelIds(line.split("：**")[0])) {
        result.set(id, { efforts: ["low", "high", "max"], defaultEffort: "high" });
      }
    }
  }

  for (const profile of result.values()) {
    if (!profile.efforts.every((effort) => EFFORT_IDS.has(effort)) || !profile.efforts.includes(profile.defaultEffort)) {
      throw new Error("Chat API 推理强度档位解析结果异常");
    }
  }
  if (!result.has("qwen3.8-max") || !result.has("deepseek-v4-pro-0813")) {
    throw new Error("Chat API 推理强度模型映射解析不完整");
  }
  return result;
}

export function parseHarnessCapabilities(markdown) {
  const personal = section(markdown, "### 个人版", "###");
  const rows = tableRows(personal);
  const result = new Map();
  for (const cells of rows) {
    if (cells.length < 2 || cells[0] === "模型") continue;
    const id = cells[0].replace(/`/g, "").trim();
    const tools = cells[1].split(/[、，,]/).map((label) => TOOL_FROM_CN[label.trim()]).filter(Boolean);
    if (id && tools.length) result.set(id, HARNESS_TOOL_TYPES.filter((tool) => tools.includes(tool)));
  }
  if (result.size === 0) throw new Error("内置工具个人版能力表解析结果为空");
  return result;
}

function hashDocuments(documents) {
  const hash = createHash("sha256");
  for (const key of Object.keys(OFFICIAL_DOC_URLS)) hash.update(key).update("\0").update(documents[key]).update("\0");
  return hash.digest("hex");
}

/** 将五份官方文档合并成一个可供 Adapter 原子读取的目录快照。 */
export function parseOfficialCatalog(documents, syncedAt = new Date().toISOString(), reasoningProbes) {
  for (const key of Object.keys(OFFICIAL_DOC_URLS)) {
    if (typeof documents[key] !== "string" || documents[key].length < 200) throw new Error(`官方文档 ${key} 内容异常`);
  }
  const personal = parsePersonalModels(documents.personal);
  const responses = parseResponsesModels(documents.responses);
  const metadata = parseOpenClawMetadata(documents.openclaw);
  const harness = parseHarnessCapabilities(documents.tools);
  const reasoningProfiles = parseReasoningProfiles(documents.chat);
  const fallback = new Map(FALLBACK_METADATA.map((model) => [model.id, model]));
  const models = personal
    .filter((model) => responses.has(model.id))
    .map((entry) => {
      const meta = metadata.get(entry.id) ?? fallback.get(entry.id) ?? {};
      const probe = reasoningProbes?.models?.[entry.id];
      if (probe) {
        if (!Array.isArray(probe.accepted) || !Array.isArray(probe.semanticEfforts)
          || !probe.semanticEfforts.every((effort) => probe.accepted.includes(effort))
          || (probe.semanticEfforts.length > 0 && !probe.semanticEfforts.includes(probe.defaultEffort))
          || (probe.semanticEfforts.length === 0 && probe.defaultEffort !== null)) {
          throw new Error(`推理强度探测覆盖 ${entry.id} 格式异常`);
        }
      }
      const documentedProfile = reasoningProfiles.get(entry.id);
      const reasoningProfile = probe?.semanticEfforts?.length
        ? { efforts: probe.semanticEfforts, defaultEffort: probe.defaultEffort }
        : probe
          ? undefined
        : documentedProfile;
      return {
        id: entry.id,
        brand: entry.brand,
        capabilities: entry.capabilities,
        ...(probe?.transport === "chat" ? { transport: "chat" } : {}),
        reasoning: Boolean(reasoningProfile),
        ...(reasoningProfile ? {
          reasoningEfforts: [...reasoningProfile.efforts],
          defaultReasoningEffort: reasoningProfile.defaultEffort,
        } : {}),
        ...(probe ? {
          acceptedReasoningEfforts: [...probe.accepted],
          rejectedReasoningEfforts: [...(probe.rejected ?? [])],
          reasoningAliases: { ...(probe.aliases ?? {}) },
        } : {}),
        input: meta.input?.length ? [...meta.input] : ["text"],
        ...(Number.isFinite(meta.contextWindow) ? { contextWindow: meta.contextWindow } : {}),
        ...(Number.isFinite(meta.maxTokens) ? { maxTokens: meta.maxTokens } : {}),
        harnessTools: [...(harness.get(entry.id) ?? [])],
      };
    });
  if (models.length < 2) throw new Error("个人版与 Responses API 支持模型交集异常");
  return {
    version: 3,
    source: reasoningProbes ? "official-docs+verified-probes" : "official-docs",
    syncedAt,
    fingerprint: hashDocuments(documents),
    ...(reasoningProbes?.testedAt ? { reasoningProbedAt: reasoningProbes.testedAt } : {}),
    models,
  };
}
