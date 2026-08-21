import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("run through npm so npm_execpath is available");
const forbidden = /(^|\/)(?:\.env(?:\..*)?|\.npmrc|\.credentials(?:\.ya?ml)?|catalog\.json|node_modules)(?:\/|$)/;
const required = ["package.json", "README.md", "LICENSE", "cordis.patch.yml", "AGENTS.md"];

for (const entry of readdirSync("packages", { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const manifest = JSON.parse(readFileSync(join("packages", entry.name, "package.json"), "utf8"));
  if (manifest.private) continue;
  const stdout = execFileSync(process.execPath, [npmCli, "pack", "--dry-run", "--json", "--ignore-scripts", "--workspace", manifest.name], { encoding: "utf8" });
  const report = JSON.parse(stdout)[0];
  const files = report.files.map((file) => file.path);
  const bad = files.filter((file) => forbidden.test(file));
  const missing = required.filter((file) => !files.includes(file));
  if (bad.length || missing.length) throw new Error(`${manifest.name}: forbidden=${bad.join(",")} missing=${missing.join(",")}`);
  console.log(`${manifest.name}: ${files.length} files, ${report.unpackedSize} bytes, package audit OK`);
}
