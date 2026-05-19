import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const state = JSON.parse(await readFile(new URL("../state/index.json", import.meta.url), "utf-8"));

assert.equal(state.schemaVersion, 1);
assert.ok(Array.isArray(state.repositories));
assert.match(state.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
