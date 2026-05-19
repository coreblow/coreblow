import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateCatalog } from "../src/catalog.mjs";

const entries = JSON.parse(await readFile(new URL("../catalog.json", import.meta.url), "utf-8"));
const errors = validateCatalog(entries);

assert.deepEqual(errors, []);
assert.equal(entries[0].id, "coreblow");
