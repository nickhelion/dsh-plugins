import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

const packageName = "dsh-qwen-token-plan-cn-responses";
const snapshotPath = "packages/qwen-token-plan-cn-responses/lib/catalog.snapshot.json";
try {
  execFileSync("git", ["diff", "--quiet", "--", snapshotPath]);
  throw new Error("catalog snapshot is unchanged");
} catch (error) {
  if (error?.status !== 1) throw error;
}

const manifestPath = "packages/qwen-token-plan-cn-responses/package.json";
const readmePath = "packages/qwen-token-plan-cn-responses/README.md";
const changelogPath = "packages/qwen-token-plan-cn-responses/CHANGELOG.md";
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const match = manifest.version.match(/^(\d+)\.(\d+)\.(\d+)$/);
if (!match) throw new Error(`cannot patch-bump non-stable version ${manifest.version}`);
const previous = manifest.version;
const next = `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));

manifest.version = next;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const readme = await readFile(readmePath, "utf8");
await writeFile(readmePath, readme.replaceAll(`${packageName}@${previous}`, `${packageName}@${next}`));

let changelog = await readFile(changelogPath, "utf8");
const entry = `## [${next}] - ${new Date().toISOString().slice(0, 10)}\n\n### Changed\n\n- Refreshed the release-bundled official model/tool/reasoning catalog (${snapshot.models.length} models, fingerprint \`${snapshot.fingerprint.slice(0, 12)}\`).\n\n`;
if (!changelog.includes("## [Unreleased]\n")) throw new Error("changelog has no Unreleased section");
changelog = changelog.replace("## [Unreleased]\n\n", `## [Unreleased]\n\n${entry}`);
changelog = changelog.replace(
  /^\[Unreleased\]:.*$/m,
  `[Unreleased]: https://github.com/nickhelion/dsh-plugins/compare/qwen-token-plan-cn-responses-v${next}...HEAD\n[${next}]: https://github.com/nickhelion/dsh-plugins/releases/tag/qwen-token-plan-cn-responses-v${next}`,
);
await writeFile(changelogPath, changelog);
console.log(`Prepared catalog release ${previous} -> ${next}.`);
