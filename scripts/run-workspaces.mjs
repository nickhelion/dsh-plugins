import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const script = process.argv[2];
if (!script) throw new Error("usage: node scripts/run-workspaces.mjs <script>");
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("run through npm so npm_execpath is available");

for (const entry of readdirSync("packages", { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const manifest = JSON.parse(readFileSync(join("packages", entry.name, "package.json"), "utf8"));
  if (!manifest.scripts?.[script]) continue;
  console.log(`\n==> ${manifest.name}: ${script}`);
  execFileSync(process.execPath, [npmCli, "run", script, "--workspace", manifest.name], { stdio: "inherit" });
}
