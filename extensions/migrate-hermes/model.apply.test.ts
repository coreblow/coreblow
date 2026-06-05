import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildHermesMigrationProvider } from "./provider.js";
import {
  cleanupTempRoots,
  makeConfigRuntime,
  makeContext,
  makeTempRoot,
  writeFile,
} from "./test/provider-helpers.js";

describe("Hermes migration model apply", () => {
  afterEach(async () => {
    await cleanupTempRoots();
  });

  it("updates the default CoreBlow model through the config runtime", async () => {
    const root = await makeTempRoot();
    const source = path.join(root, "hermes");
    const config = { agents: { defaults: { model: "anthropic/claude" } } };
    await writeFile(path.join(source, "config.yaml"), "provider: openai\nmodel: gpt-5.4\n");

    const provider = buildHermesMigrationProvider({ runtime: makeConfigRuntime(config) });
    const ctx = makeContext({
      source,
      stateDir: path.join(root, "state"),
      workspaceDir: path.join(root, "workspace"),
      config,
      overwrite: true,
      runtime: makeConfigRuntime(config),
    });
    const result = await provider.apply(ctx);

    expect(result.summary.errors).toBe(0);
    expect(config.agents?.defaults?.model).toEqual({ primary: "openai/gpt-5.4" });
  });
});
