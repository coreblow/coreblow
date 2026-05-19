import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validatePluginManifest } from "../src/manifest.mjs";

const manifest = JSON.parse(
  await readFile(new URL("../fixtures/basic-plugin/coreblow.plugin.json", import.meta.url), "utf-8"),
);

assert.deepEqual(validatePluginManifest(manifest), []);
assert.match(manifest.coreblow.compatibility, /^>=/);
