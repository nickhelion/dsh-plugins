import snapshot from "./catalog.snapshot.json" with { type: "json" };

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function validate(value) {
  if (value?.version !== 3 || value.source !== "official-docs+verified-probes") {
    throw new Error("bundled Qwen catalog has an unsupported format");
  }
  if (!Array.isArray(value.models) || value.models.length < 2) throw new Error("bundled Qwen catalog is empty");
  const ids = new Set();
  for (const model of value.models) {
    if (!model?.id || ids.has(model.id)) throw new Error("bundled Qwen catalog contains an invalid or duplicate model id");
    ids.add(model.id);
    if (!Array.isArray(model.input) || !Array.isArray(model.harnessTools)) throw new Error(`bundled Qwen catalog model ${model.id} is malformed`);
    if (model.reasoning) {
      if (!Array.isArray(model.reasoningEfforts) || !model.reasoningEfforts.includes(model.defaultReasoningEffort)) {
        throw new Error(`bundled Qwen catalog model ${model.id} has an invalid reasoning profile`);
      }
    }
  }
  return value;
}

/** Immutable, release-versioned catalog. Runtime never fetches documentation. */
export const BUNDLED_CATALOG = deepFreeze(validate(snapshot));

/** Small runtime seam consumed by the adapter. */
export class CatalogSnapshot {
  snapshot() { return BUNDLED_CATALOG; }
}
