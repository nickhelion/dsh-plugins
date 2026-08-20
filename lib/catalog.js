import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { HARNESS_TOOL_TYPES } from "./harness.js";

export const OFFICIAL_DOC_URLS = Object.freeze({
  personal: "https://platform.qianwenai.com/docs/token-plan/personal/token-plan-personal-overview.md",
  tools: "https://platform.qianwenai.com/docs/token-plan/best-practices/built-in-tools.md",
  openclaw: "https://platform.qianwenai.com/docs/developer-guides/clients-and-developer-tools/openclaw.md",
  responses: "https://platform.qianwenai.com/docs/api-reference/chat/openai-responses.md",
});

const TOOL_FROM_CN = Object.freeze({
  联网搜索: "web_search",
  代码解释器: "code_interpreter",
  网页抓取: "web_extractor",
  以图搜图: "image_search",
  文搜图: "web_search_image",
});

const BOOTSTRAP_MODELS = Object.freeze([
  { id: "qwen3.8-max", reasoning: true, input: ["text", "image"], contextWindow: 983616, maxTokens: 131072,
    harnessTools: [...HARNESS_TOOL_TYPES] },
  { id: "qwen3.7-max", reasoning: false, input: ["text"], contextWindow: 1000000, maxTokens: 65536,
    harnessTools: ["web_search", "code_interpreter", "web_extractor"] },
  { id: "qwen3.7-plus", reasoning: false, input: ["text", "image"], contextWindow: 1000000, maxTokens: 65536,
    harnessTools: [...HARNESS_TOOL_TYPES] },
  { id: "qwen3.6-flash", reasoning: false, input: ["text", "image"], contextWindow: 1000000, maxTokens: 32768, harnessTools: [] },
  { id: "glm-5.2", reasoning: false, input: ["text"], contextWindow: 1000000, maxTokens: 16384, harnessTools: [] },
  { id: "deepseek-v4-pro", reasoning: false, input: ["text"], contextWindow: 163840, maxTokens: 32768, harnessTools: [] },
  { id: "deepseek-v4-pro-0813", reasoning: false, input: ["text"], contextWindow: 163840, maxTokens: 32768, harnessTools: [] },
  { id: "deepseek-v4-flash-0731", reasoning: false, input: ["text"], contextWindow: 1000000, maxTokens: 393216, harnessTools: [] },
]);

export const BOOTSTRAP_CATALOG = Object.freeze({
  version: 1,
  source: "embedded-bootstrap",
  syncedAt: "2026-08-20T00:00:00.000Z",
  fingerprint: "embedded-2026-08-20",
  models: BOOTSTRAP_MODELS.map((model) => Object.freeze({ ...model, input: Object.freeze([...model.input]), harnessTools: Object.freeze([...model.harnessTools]) })),
});

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

/** 将四份官方文档合并成一个可供 Adapter 原子读取的目录快照。 */
export function parseOfficialCatalog(documents, syncedAt = new Date().toISOString()) {
  for (const key of Object.keys(OFFICIAL_DOC_URLS)) {
    if (typeof documents[key] !== "string" || documents[key].length < 200) throw new Error(`官方文档 ${key} 内容异常`);
  }
  const personal = parsePersonalModels(documents.personal);
  const responses = parseResponsesModels(documents.responses);
  const metadata = parseOpenClawMetadata(documents.openclaw);
  const harness = parseHarnessCapabilities(documents.tools);
  const bootstrap = new Map(BOOTSTRAP_MODELS.map((model) => [model.id, model]));
  const models = personal
    .filter((model) => responses.has(model.id))
    .map((entry) => {
      const meta = metadata.get(entry.id) ?? bootstrap.get(entry.id) ?? {};
      return {
        id: entry.id,
        brand: entry.brand,
        capabilities: entry.capabilities,
        reasoning: meta.reasoning === true,
        input: meta.input?.length ? [...meta.input] : ["text"],
        ...(Number.isFinite(meta.contextWindow) ? { contextWindow: meta.contextWindow } : {}),
        ...(Number.isFinite(meta.maxTokens) ? { maxTokens: meta.maxTokens } : {}),
        harnessTools: [...(harness.get(entry.id) ?? [])],
      };
    });
  if (models.length < 2) throw new Error("个人版与 Responses API 支持模型交集异常");
  return { version: 1, source: "official-docs", syncedAt, fingerprint: hashDocuments(documents), models };
}

async function readCache(cacheFile) {
  try {
    const parsed = JSON.parse(await readFile(cacheFile, "utf8"));
    if (parsed?.version !== 1 || !Array.isArray(parsed?.catalog?.models) || parsed.catalog.models.length < 2) return undefined;
    return parsed;
  } catch { return undefined; }
}

async function writeCache(cacheFile, value) {
  await mkdir(dirname(cacheFile), { recursive: true });
  const temporary = `${cacheFile}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, cacheFile);
}

/**
 * 深模块：外部只看 snapshot/start/refresh，内部隐藏条件请求、四文档合并、校验、
 * 原子缓存与 last-known-good 回退。
 */
export class CatalogManager {
  #catalog = BOOTSTRAP_CATALOG;
  #sourceCache = {};
  #inFlight;
  #timer;

  constructor({ cacheFile, fetchImpl = globalThis.fetch, urls = OFFICIAL_DOC_URLS, refreshMs = 21600000, timeoutMs = 30000, logger = console, onUpdate } = {}) {
    if (!cacheFile) throw new Error("CatalogManager 需要 cacheFile");
    this.cacheFile = cacheFile;
    this.fetchImpl = fetchImpl;
    this.urls = urls;
    this.refreshMs = refreshMs;
    this.timeoutMs = timeoutMs;
    this.logger = logger;
    this.onUpdate = onUpdate;
  }

  snapshot() { return this.#catalog; }

  async start() {
    const cached = await readCache(this.cacheFile);
    if (cached) {
      this.#catalog = cached.catalog;
      this.#sourceCache = cached.sources ?? {};
      this.onUpdate?.(this.#catalog);
    }
    try { await this.refresh(); }
    catch (error) { this.logger.warn?.(`qwen-token-plan-cn-responses: 官方目录刷新失败，继续使用最近可用目录：${error instanceof Error ? error.message : String(error)}`); }
    if (Number.isFinite(this.refreshMs) && this.refreshMs > 0) {
      this.#timer = setInterval(() => void this.refresh().catch((error) => {
        this.logger.warn?.(`qwen-token-plan-cn-responses: 定时目录刷新失败：${error instanceof Error ? error.message : String(error)}`);
      }), this.refreshMs);
      this.#timer.unref?.();
    }
    return this.#catalog;
  }

  stop() { if (this.#timer) clearInterval(this.#timer); this.#timer = undefined; }

  refresh() {
    if (this.#inFlight) return this.#inFlight;
    this.#inFlight = this.#refresh().finally(() => { this.#inFlight = undefined; });
    return this.#inFlight;
  }

  async #refresh() {
    const nextSources = {};
    const documents = {};
    for (const [key, url] of Object.entries(this.urls)) {
      const previous = this.#sourceCache[key];
      const headers = { Accept: "text/markdown" };
      if (previous?.etag) headers["If-None-Match"] = previous.etag;
      if (previous?.lastModified) headers["If-Modified-Since"] = previous.lastModified;
      const response = await this.fetchImpl(url, { headers, signal: AbortSignal.timeout(this.timeoutMs) });
      if (response.status === 304 && previous?.body) {
        nextSources[key] = previous;
        documents[key] = previous.body;
        continue;
      }
      if (!response.ok) throw new Error(`${key} 返回 HTTP ${response.status}`);
      const body = await response.text();
      nextSources[key] = {
        url,
        body,
        etag: response.headers.get("etag") ?? undefined,
        lastModified: response.headers.get("last-modified") ?? undefined,
      };
      documents[key] = body;
    }
    const catalog = parseOfficialCatalog(documents);
    const changed = catalog.fingerprint !== this.#catalog.fingerprint;
    this.#catalog = catalog;
    this.#sourceCache = nextSources;
    await writeCache(this.cacheFile, { version: 1, catalog, sources: nextSources });
    if (changed) this.onUpdate?.(catalog);
    this.logger.info?.(`qwen-token-plan-cn-responses: 官方目录已同步（${catalog.models.length} 个 Responses 模型，${catalog.syncedAt}）`);
    return catalog;
  }
}
