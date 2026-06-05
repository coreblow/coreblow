import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { HERMES_REASON_INCLUDE_CREDENTIALS } from "./items.js";
import { buildHermesMigrationProvider } from "./provider.js";
import { cleanupTempRoots, makeContext, makeTempRoot, writeFile } from "./test/provider-helpers.js";

describe("Hermes migration provider secret items", () => {
  afterEach(async () => {
    await cleanupTempRoots();
  });

  it("keeps detected secrets skipped unless includeSecrets is enabled", async () => {
    const root = await makeTempRoot();
    const source = path.join(root, "hermes");
    await writeFile(path.join(source, ".env"), "OPENAI_API_KEY=sk-hermes\n");

    const plan = await buildHermesMigrationProvider().plan(
      makeContext({
        source,
        stateDir: path.join(root, "state"),
        workspaceDir: path.join(root, "workspace"),
      }),
    );
    const secret = plan.items.find((item) => item.id === "secret:openai");

    expect(secret?.status).toBe("skipped");
    expect(secret?.reason).toBe(HERMES_REASON_INCLUDE_CREDENTIALS);
  });
});
