import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  canLoadActivatedBundledPluginPublicSurface,
  resetFacadeRuntimeStateForTest,
} from "./facade-runtime.js";

describe("plugin-sdk facade runtime", () => {
  afterEach(() => {
    resetFacadeRuntimeStateForTest();
  });

  it("loads facade-activation-check.runtime without throwing when resolving bundled plugin access", () => {
    const allowed = canLoadActivatedBundledPluginPublicSurface({
      dirName: "ollama",
      artifactBasename: "index.js",
      env: process.env,
    });
    expect(typeof allowed).toBe("boolean");
  });

  it("registers facade-activation-check.runtime as a top-level dist bundle entry", () => {
    const tsdownConfig = fs.readFileSync(path.resolve(process.cwd(), "tsdown.config.ts"), "utf8");
    expect(tsdownConfig).toContain(
      '"facade-activation-check.runtime": "src/plugin-sdk/facade-activation-check.runtime.ts"',
    );
  });
});
