import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";

const candidates = [];
const add = (label, value) => {
  const normalized = value?.trim().replace(/^(['"])(.*)\1$/, "$2");
  if (normalized && normalized.length >= 16) candidates.push({ label, value: normalized });
};

const credentialsPath = `${homedir()}/.dsh/.credentials.yaml`;
if (existsSync(credentialsPath)) {
  for (const line of readFileSync(credentialsPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET)[A-Z0-9_]*)\s*:\s*(.*?)\s*$/);
    if (match) add(`DSH credential ${match[1]}`, match[2]);
  }
}

const serverChanPath = `${homedir()}/.dsh/secrets/serverchan_sendkey`;
if (existsSync(serverChanPath)) add("ServerChan SendKey", readFileSync(serverChanPath, "utf8"));

for (const name of ["NPM_TOKEN", "NODE_AUTH_TOKEN", "QWEN_TOKEN_PLAN_CN_API_KEY", "SERVERCHAN_SENDKEY"]) {
  add(`environment variable ${name}`, process.env[name]);
}

if (candidates.length === 0) {
  console.log("No known local credential values are available; exact-secret scan skipped.");
  process.exit(0);
}

const listed = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"]);
const paths = listed.toString("utf8").split("\0").filter(Boolean);
const currentHits = [];
for (const path of paths) {
  let content;
  try {
    content = readFileSync(path);
  } catch {
    continue;
  }
  for (const secret of candidates) {
    if (content.includes(Buffer.from(secret.value))) currentHits.push(`${secret.label} in ${path}`);
  }
}

const revisions = execFileSync("git", ["rev-list", "--all"], { encoding: "utf8" }).trim().split(/\s+/).filter(Boolean);
const historyHits = [];
for (const secret of candidates) {
  const result = spawnSync("git", ["grep", "-F", "-l", "--", secret.value, ...revisions], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status === 0) historyHits.push(secret.label);
  else if (result.status !== 1) throw new Error(`Git history scan failed for ${secret.label}`);
}

if (currentHits.length || historyHits.length) {
  for (const hit of currentHits) console.error(`Exact-secret match: ${hit}`);
  for (const label of historyHits) console.error(`Exact-secret match in Git history: ${label}`);
  throw new Error("secret scan failed; values were intentionally not printed");
}

console.log(`Exact-secret scan passed for ${candidates.length} local credential value(s); values were not printed.`);
