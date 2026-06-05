import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildHermesMigrationProvider } from "./provider.js";
import { cleanupTempRoots, makeContext, makeTempRoot, writeFile } from "./test/provider-helpers.js";

describe("Hermes migration config mapping", () => {
  afterEach(async () => {
    await cleanupTempRoots();
  });

  it("plans provider and MCP config patches", async () => {
    const root = await makeTempRoot();
    const source = path.join(root, "hermes");
    await writeFile(
      path.join(source, "config.yaml"),
      [
        "model: gpt-5.4",
        "provider: openai",
        "mcp:",
        "  time:",
        "    command: npx",
        "    args: ['-y', '@modelcontextprotocol/server-time']",
      ].join("\n"),
    );

    const plan = await buildHermesMigrationProvider().plan(
      makeContext({
        source,
        stateDir: path.join(root, "state"),
        workspaceDir: path.join(root, "workspace"),
      }),
    );

    expect(plan.items.some((item) => item.id === "config:model-providers")).toBe(true);
    expect(plan.items.some((item) => item.id === "config:mcp-servers")).toBe(true);
  });
});
