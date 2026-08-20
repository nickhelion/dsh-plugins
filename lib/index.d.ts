import type { Context } from "@deepseek-ai/cordis";

/** Configuration accepted by the dsh-serverchan-notify plugin. */
export interface ServerChanNotifyConfig {
  /** Inline SendKey. Outranked by the SERVERCHAN_SENDKEY env var. */
  sendkey?: string;
  /** Path to a file containing the SendKey; `~` is expanded. */
  sendkeyFile?: string;
  /** Which turn/end reason kinds trigger a push; `interrupted` is never pushed. */
  reasons?: string[];
  /** Also push subagent sessions (default false). */
  notifySubagents?: boolean;
  /** HTTP timeout in milliseconds (default 8000). */
  timeoutMs?: number;
  /** Truncation length for the reply excerpt (default 16000). */
  maxResponseChars?: number;
  /** Disable without removing the loader row (default false). */
  disabled?: boolean;
}

/** Plugin module name (used as the loader row's `name`). */
export const name: string;

/**
 * Cordis plugin entry. Mount it via a loader row (`cordis.patch.yml`) or
 * `ctx.plugin(...)`: it subscribes to `session/event` and pushes a
 * ServerChan3 notification per finished top-level turn.
 */
export default function serverchanNotify(
  ctx: Context,
  config?: ServerChanNotifyConfig,
): void;
