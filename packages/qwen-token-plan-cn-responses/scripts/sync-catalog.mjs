import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { OFFICIAL_DOC_URLS, parseOfficialCatalog } from "../lib/catalog-source.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const snapshotFile = join(root, "lib", "catalog.snapshot.json");
const probesFile = join(root, "catalog", "reasoning-probes.json");

async function fetchDocument(name, url) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/markdown",
      "User-Agent": "dsh-qwen-token-plan-cn-responses-catalog-sync",
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${name} returned HTTP ${response.status}`);
  const body = await response.text();
  if (body.length < 200) throw new Error(`${name} document is unexpectedly short`);
  return body;
}

const documents = Object.fromEntries(await Promise.all(
  Object.entries(OFFICIAL_DOC_URLS).map(async ([name, url]) => [name, await fetchDocument(name, url)]),
));
const probes = JSON.parse(await readFile(probesFile, "utf8"));
let previous;
try { previous = JSON.parse(await readFile(snapshotFile, "utf8")); } catch {}

const candidate = parseOfficialCatalog(documents, previous?.syncedAt ?? new Date().toISOString(), probes);
const comparable = (value) => JSON.stringify({
  version: value?.version,
  source: value?.source,
  fingerprint: value?.fingerprint,
  reasoningProbedAt: value?.reasoningProbedAt,
  models: value?.models,
});

if (previous && comparable(previous) === comparable(candidate)) {
  console.log(`Catalog unchanged (${candidate.models.length} models, ${candidate.fingerprint.slice(0, 12)}).`);
  process.exit(0);
}

candidate.syncedAt = new Date().toISOString();
const temporary = `${snapshotFile}.${process.pid}.tmp`;
await writeFile(temporary, `${JSON.stringify(candidate, null, 2)}\n`);
await rename(temporary, snapshotFile);
console.log(`Catalog updated: ${candidate.models.length} models, ${candidate.fingerprint.slice(0, 12)}.`);
