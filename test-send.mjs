#!/usr/bin/env node
/**
 * 独立测试脚本：向 Server酱3 推送一条测试通知，验证 key 与网络通路。
 * SendKey 解析顺序与插件一致：
 *   1. 环境变量 SERVERCHAN_SENDKEY
 *   2. 环境变量 SERVERCHAN_SENDKEY_FILE 指定的文件
 *   3. 命令行参数 1：显式 key 文件路径
 *   4. 默认 $DSH_HOME/secrets/serverchan_sendkey（~/.dsh/secrets/serverchan_sendkey）
 * 用法：node test-send.mjs ["自定义标题"]
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

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

const keyArg = process.argv[2];
const sendkey = process.env.SERVERCHAN_SENDKEY
  || readKeyFile(process.env.SERVERCHAN_SENDKEY_FILE)
  || (keyArg && !keyArg.includes(" ") && existsSync(keyArg) ? readKeyFile(keyArg) : "")
  || readKeyFile(join(dshHome(), "secrets", "serverchan_sendkey"));

if (!sendkey) {
  console.error(
    "找不到 SendKey。请任选其一：\n"
    + "  1. export SERVERCHAN_SENDKEY=sctp...\n"
    + "  2. export SERVERCHAN_SENDKEY_FILE=/path/to/keyfile\n"
    + "  3. node test-send.mjs /path/to/keyfile\n"
    + `  4. 把 key 写入默认文件 ${join(dshHome(), "secrets", "serverchan_sendkey")}`,
  );
  process.exit(2);
}

const match = /^sctp(\d+)t/.exec(sendkey);
const url = match
  ? `https://${match[1]}.push.ft07.com/send/${sendkey}.send`
  : `https://sctapi.ftqq.com/${sendkey}.send`;

const titleArg = process.argv[3] ?? (process.argv[2]?.includes(" ") ? process.argv[2] : void 0);
const title = titleArg ?? "DSH Server酱 测试通知";
const desp = [
  "## ✅ 测试成功",
  "这是一条来自 `dsh-serverchan-notify` 插件的测试推送。",
  `- **时间**：${new Date().toISOString()}`,
  `- **来源**：${import.meta.url}`,
  "",
  "收到这条消息说明 SendKey、专属 push 域名与网络通路全部正常。",
].join("\n");

const response = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": "DSH-ServerChan-Notify/1.0 curl-compatible",
  },
  body: new URLSearchParams({ title, desp }),
  signal: AbortSignal.timeout(8000),
});
const result = await response.json();
console.log("HTTP", response.status, "code:", result?.code, "message:", result?.message);
if (result?.code === 0) {
  console.log("推送成功 ✔");
} else {
  console.error("推送失败 ✘");
  process.exit(1);
}
