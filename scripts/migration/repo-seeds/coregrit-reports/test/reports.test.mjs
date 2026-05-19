import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const index = JSON.parse(await readFile(new URL("../reports/index.json", import.meta.url), "utf-8"));

assert.equal(index.schemaVersion, 1);
assert.ok(Array.isArray(index.reports));
