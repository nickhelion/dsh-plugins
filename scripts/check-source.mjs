import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

function javascriptFiles(root) {
  const result = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...javascriptFiles(path));
    else if (/\.(?:js|mjs)$/.test(entry.name)) result.push(path);
  }
  return result;
}

const files = ["lib", "scripts", "test"].flatMap(javascriptFiles);
for (const file of files) execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
console.log(`Syntax OK: ${files.length} JavaScript files`);
