import { CallId, LlmError } from "@deepseek-ai/dsh-llm";
import { formatHarnessActivity } from "./harness.js";

function eventData(raw) {
  const lines = [];
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith("data:")) lines.push(line.slice(5).replace(/^\s/, ""));
  }
  return lines.length ? lines.join("\n") : undefined;
}

/** 无第三方依赖的 SSE data JSON 迭代器，兼容 LF/CRLF、多 data 行和尾事件。 */
export async function* iterateSse(body, signal) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      while (true) {
        const separator = /\r?\n\r?\n/.exec(buffer);
        if (!separator) break;
        const raw = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);
        const data = eventData(raw);
        if (!data || data === "[DONE]") continue;
        try { yield JSON.parse(data); }
        catch { /* 供应商偶发的非 JSON 心跳不应杀死整个回复。 */ }
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      const data = eventData(buffer);
      if (data && data !== "[DONE]") {
        try { yield JSON.parse(data); } catch { /* ignore trailing heartbeat */ }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* already released */ }
  }
}

function itemMessageText(item) {
  if (!Array.isArray(item?.content)) return "";
  return item.content.map((part) => part && typeof part === "object" ? String(part.text ?? "") : "").join("");
}

function itemReasoningText(item) {
  for (const key of ["summary", "content"]) {
    if (Array.isArray(item?.[key])) {
      const text = item[key].map((part) => part && typeof part === "object" ? String(part.text ?? "") : "").join("");
      if (text) return text;
    }
  }
  return "";
}

function usageFrom(response) {
  const usage = response?.usage ?? {};
  const details = usage.input_tokens_details ?? {};
  const outputDetails = usage.output_tokens_details ?? {};
  const totalInput = Number.isFinite(usage.input_tokens) ? usage.input_tokens : 0;
  const cacheRead = Number.isFinite(details.cached_tokens) ? details.cached_tokens : 0;
  const cacheWrite = Number.isFinite(usage.cache_creation_input_tokens)
    ? usage.cache_creation_input_tokens
    : Number.isFinite(details.cache_creation_input_tokens) ? details.cache_creation_input_tokens : 0;
  return {
    inputTokens: Math.max(0, totalInput - cacheRead - cacheWrite),
    outputTokens: Number.isFinite(usage.output_tokens) ? usage.output_tokens : 0,
    ...(cacheRead > 0 ? { cacheReadTokens: cacheRead } : {}),
    ...(cacheWrite > 0 ? { cacheWriteTokens: cacheWrite } : {}),
    ...(Number.isFinite(outputDetails.reasoning_tokens) && outputDetails.reasoning_tokens > 0
      ? { reasoningTokens: outputDetails.reasoning_tokens } : {}),
  };
}

function failure(message, code, status) {
  return { message, code, ...(status ? { status } : {}) };
}

function mergeHarnessActivity(activity, item, itemId) {
  const type = String(item?.type ?? "");
  if (!type || ["message", "reasoning", "function_call"].includes(type)) return;
  const id = String(item?.id ?? itemId ?? "");
  const hit = activity.find((entry) => entry.type === type && id && entry.itemId === id);
  if (hit) {
    hit.status = item.status ?? hit.status;
    hit.data = item;
  } else activity.push({ type, itemId: id || undefined, status: item.status, data: item });
}

/** 把 Qwen Responses SSE 翻译为 DSH StreamChunk 协议。 */
export async function* responsesToDshChunks(body, signal) {
  const slots = new Map();
  const activity = [];
  let nextIndex = 0;
  let terminal;
  let sawContent = false;
  let sawFunctionCall = false;

  for await (const event of iterateSse(body, signal)) {
    const outputIndex = Number.isInteger(event.output_index) ? event.output_index : -1;
    switch (event.type) {
      case "response.output_item.added": {
        const item = event.item ?? {};
        if (outputIndex < 0) break;
        if (item.type === "message") {
          const slot = { kind: "text", index: nextIndex++, text: "" };
          slots.set(outputIndex, slot);
          yield { type: "block-start", index: slot.index, blockType: "text" };
        } else if (item.type === "reasoning") {
          const slot = { kind: "reasoning", index: nextIndex++, text: "" };
          slots.set(outputIndex, slot);
          yield { type: "block-start", index: slot.index, blockType: "reasoning" };
        } else if (item.type === "function_call") {
          const slot = {
            kind: "tool-call", index: nextIndex++, id: CallId(String(item.call_id ?? item.id ?? `call_${outputIndex}`)),
            name: String(item.name ?? ""), arguments: String(item.arguments ?? ""),
          };
          slots.set(outputIndex, slot);
          yield { type: "block-start", index: slot.index, blockType: "tool-call" };
          if (slot.name || slot.arguments) yield { type: "tool-call-delta", index: slot.index, id: slot.id, name: slot.name, argumentsDelta: slot.arguments };
        } else mergeHarnessActivity(activity, item, event.item_id);
        break;
      }

      case "response.output_text.delta": {
        const slot = slots.get(outputIndex);
        if (slot?.kind === "text" && typeof event.delta === "string" && event.delta) {
          slot.text += event.delta; sawContent = true;
          yield { type: "text-delta", index: slot.index, text: event.delta };
        }
        break;
      }

      case "response.reasoning_summary_text.delta":
      case "response.reasoning_text.delta": {
        const slot = slots.get(outputIndex);
        if (slot?.kind === "reasoning" && typeof event.delta === "string" && event.delta) {
          slot.text += event.delta; sawContent = true;
          yield { type: "reasoning-delta", index: slot.index, text: event.delta };
        }
        break;
      }

      case "response.function_call_arguments.delta": {
        const slot = slots.get(outputIndex);
        if (slot?.kind === "tool-call" && typeof event.delta === "string" && event.delta) {
          slot.arguments += event.delta; sawContent = true;
          yield { type: "tool-call-delta", index: slot.index, id: slot.id, argumentsDelta: event.delta };
        }
        break;
      }

      case "response.output_item.done": {
        const item = event.item ?? {};
        const slot = slots.get(outputIndex);
        if (!slot) { mergeHarnessActivity(activity, item, event.item_id); break; }
        if (slot.kind === "text") {
          const finalText = itemMessageText(item);
          if (!slot.text && finalText) {
            slot.text = finalText; sawContent = true;
            yield { type: "text-delta", index: slot.index, text: finalText };
          }
          yield { type: "block-end", index: slot.index, block: { type: "text", text: slot.text } };
        } else if (slot.kind === "reasoning") {
          const finalText = itemReasoningText(item);
          if (!slot.text && finalText) {
            slot.text = finalText; sawContent = true;
            yield { type: "reasoning-delta", index: slot.index, text: finalText };
          }
          yield { type: "block-end", index: slot.index, block: { type: "reasoning", text: slot.text } };
        } else {
          const finalArguments = String(item.arguments ?? slot.arguments ?? "{}");
          if (!slot.arguments && finalArguments) {
            slot.arguments = finalArguments; sawContent = true;
            yield { type: "tool-call-delta", index: slot.index, id: slot.id, name: slot.name, argumentsDelta: finalArguments };
          }
          slot.arguments ||= "{}";
          sawFunctionCall = true; sawContent = true;
          yield { type: "block-end", index: slot.index, block: { type: "tool-call", id: slot.id, name: slot.name, arguments: slot.arguments } };
        }
        slots.delete(outputIndex);
        break;
      }

      case "response.completed":
      case "response.incomplete":
      case "response.failed":
      case "response.cancelled":
        terminal = { eventType: event.type, response: event.response ?? {} };
        break;

      case "error":
        throw new LlmError(`${event.error?.code ?? "error"}: ${event.error?.message ?? "Qwen Responses 流错误"}`, "PROVIDER_ERROR");
      default:
        break;
    }
  }

  if (signal?.aborted) throw new LlmError("Qwen Responses 请求已取消", "ABORTED", { cause: signal.reason });
  if (!terminal) throw new LlmError("Qwen Responses 流在终止事件前关闭", "STREAM_CLOSED");
  if (slots.size) throw new LlmError("Qwen Responses 流存在未结束的输出块", "STREAM_CLOSED");

  const activityText = formatHarnessActivity(activity);
  if (activityText) {
    const index = nextIndex++;
    sawContent = true;
    yield { type: "block-start", index, blockType: "text" };
    yield { type: "text-delta", index, text: activityText };
    yield { type: "block-end", index, block: { type: "text", text: activityText } };
  }

  const response = terminal.response;
  yield { type: "usage", usage: usageFrom(response) };
  if (terminal.eventType === "response.completed") {
    if (!sawContent) yield { type: "finish", reason: { kind: "error", failure: failure("Qwen Responses 返回空回复", "EMPTY_RESPONSE") } };
    else yield { type: "finish", reason: { kind: sawFunctionCall ? "tool-calls" : "stop" } };
  } else if (terminal.eventType === "response.incomplete") {
    const reason = response.incomplete_details?.reason;
    yield { type: "finish", reason: reason === "max_output_tokens"
      ? { kind: "max-tokens" }
      : { kind: "error", failure: failure(`Qwen Responses 未完整结束：${reason ?? "unknown"}`, "PROVIDER_ERROR") } };
  } else {
    const error = response.error ?? {};
    yield { type: "finish", reason: { kind: "error", failure: failure(`${error.code ?? "error"}: ${error.message ?? "Qwen Responses 请求失败"}`, "PROVIDER_ERROR") } };
  }
}
