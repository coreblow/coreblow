import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildHermesMigrationProvider } from "./provider.js";
import { cleanupTempRoots, makeContext, makeTempRoot, writeFile } from "./test/provider-helpers.js";

describe("Hermes migration file and skill items", () => {
  afterEach(async () => {
    await cleanupTempRoots();
  });

  it("plans workspace, memory, skill, and archive items", async () => {
    const root = await makeTempRoot();
    const source = path.join(root, "hermes");
    await writeFile(path.join(source, "SOUL.md"), "# Hermes soul\n");
    await writeFile(path.join(source, "memories", "MEMORY.md"), "remember this\n");
    await writeFile(path.join(source, "skills", "Ship It", "SKILL.md"), "# Ship It\n");
    await writeFile(path.join(source, "logs", "run.log"), "log line\n");

    const plan = await buildHermesMigrationProvider().plan(
      makeContext({
        source,
        stateDir: path.join(root, "state"),
        workspaceDir: path.join(root, "workspace"),
      }),
    );

    expect(plan.items.some((item) => item.id === "workspace:SOUL.md")).toBe(true);
    expect(plan.items.some((item) => item.id === "memory:MEMORY.md")).toBe(true);
    expect(plan.items.some((item) => item.id === "skill:ship-it")).toBe(true);
    expect(plan.items.some((item) => item.id === "archive:logs")).toBe(true);
  });
});
