import { readFileSync } from "node:fs";

const source = readFileSync(".github/workflows/publish.yml", "utf8");

function job(name, nextName) {
  const start = source.indexOf(`\n  ${name}:\n`);
  if (start < 0) throw new Error(`publish workflow is missing the ${name} job`);
  const end = nextName ? source.indexOf(`\n  ${nextName}:\n`, start + 1) : source.length;
  return source.slice(start, end < 0 ? source.length : end);
}

const tagCatalog = job("tag-catalog-release", "publish");
const publish = job("publish");

if (!/if: github\.ref_type == 'branch'/.test(tagCatalog)) {
  throw new Error("catalog tag job must be branch-only");
}
if (!/if: github\.ref_type == 'tag'/.test(publish)) {
  throw new Error("npm publish job must be tag-only to prevent branch/tag publish races");
}
if (/npm publish/.test(tagCatalog)) throw new Error("branch job must never call npm publish");
if ((publish.match(/npm publish/g) ?? []).length !== 1) throw new Error("tag job must contain exactly one npm publish command");
if (!/availability\.outputs\.publish == 'true'/.test(publish)) {
  throw new Error("npm publish must be guarded for idempotent workflow reruns");
}
const registryReads = publish.match(/npm view [^\n]*/g) ?? [];
if (registryReads.length !== 2) {
  throw new Error(`expected exactly two npm view registry reads in the publish job, found ${registryReads.length}`);
}
if (!registryReads.every((read) => read.includes("--prefer-online"))) {
  throw new Error("both registry reads must pass --prefer-online; a cached packument keeps reporting the pre-upload answer");
}
if (!/^\s*attempts=\d+$/m.test(publish) || !/for attempt in /.test(publish) || !/sleep \d/.test(publish)) {
  throw new Error("registry verification must poll over a bounded attempt budget with backoff; a single read races registry propagation and fails a live release");
}
if (!/never became visible on npm/.test(publish)) {
  throw new Error("the verification poll must fail loudly once its budget is exhausted");
}

console.log("Release workflow invariant OK: branch tags, tag publishes once, reruns are idempotent, registry reads revalidate and poll.");
