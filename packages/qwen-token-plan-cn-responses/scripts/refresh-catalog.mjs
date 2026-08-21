import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CatalogManager } from "../lib/catalog.js";

const directory = await mkdtemp(join(tmpdir(), "dsh-qwen-catalog-"));
const manager = new CatalogManager({ cacheFile: join(directory, "catalog.json"), refreshMs: 0 });
const catalog = await manager.start();
console.log(JSON.stringify(catalog, null, 2));
