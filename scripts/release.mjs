import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const definitions = {
  "dsh-qwen-token-plan-cn-responses": { dir: "qwen-token-plan-cn-responses", tag: "qwen-token-plan-cn-responses" },
  "dsh-serverchan-notify": { dir: "serverchan-notify", tag: "serverchan-notify" },
};
const [name, version, maybePush] = process.argv.slice(2);
const definition = definitions[name];
if (!definition || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version ?? "")) {
  throw new Error("usage: npm run release -- <package-name> <semver> [--push]");
}
if (maybePush !== undefined && maybePush !== "--push") throw new Error(`unknown option: ${maybePush}`);
if (execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()) throw new Error("working tree must be clean");
if (execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim() !== "main") throw new Error("release from main only");
const manifestPath = join("packages", definition.dir, "package.json");
const changelog = readFileSync(join("packages", definition.dir, "CHANGELOG.md"), "utf8");
if (!changelog.includes(`## [${version}]`)) throw new Error(`package changelog must already contain ## [${version}] in a committed change`);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
if (manifest.version === version) throw new Error(`${name} is already ${version}`);
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("run this script through npm");
const published = spawnSync(process.execPath, [npmCli, "view", `${name}@${version}`, "version", "--registry=https://registry.npmjs.org"], { encoding: "utf8" });
if (published.status === 0) throw new Error(`${name}@${version} already exists on npm`);
if (!`${published.stderr}\n${published.stdout}`.includes("E404")) {
  throw new Error(`could not verify npm availability for ${name}@${version}`);
}

manifest.version = version;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
execFileSync(process.execPath, [npmCli, "install", "--package-lock-only", "--ignore-scripts"], { stdio: "inherit" });
execFileSync(process.execPath, [npmCli, "run", "check", "--workspace", name], { stdio: "inherit" });
execFileSync(process.execPath, [npmCli, "run", "pack:check"], { stdio: "inherit" });
execFileSync(process.execPath, [npmCli, "run", "security:scan"], { stdio: "inherit" });
execFileSync("git", ["add", manifestPath, "package-lock.json"]);
execFileSync("git", ["commit", "-m", `release(${definition.dir}): v${version}`], { stdio: "inherit" });
const tag = `${definition.tag}-v${version}`;
execFileSync("git", ["tag", "-a", tag, "-m", `${name} v${version}`]);
console.log(`prepared ${tag}`);
if (maybePush === "--push") {
  execFileSync("git", ["push", "origin", "main"], { stdio: "inherit" });
  execFileSync("git", ["push", "origin", tag], { stdio: "inherit" });
}
