import { describe, it, expect } from "vitest";
import { buildWorkspaceHookStatus, type HookStatusReport } from "../../src/hooks/hooks-status.js";
import type { PolicyHookEntry } from "../../src/hooks/policy.js";

function makeEntry(name: string, source: "coreblow-bundled" | "coreblow-plugin" = "coreblow-bundled"): PolicyHookEntry {
  return {
    hook: {
      name,
      source,
      description: `${name} hook`,
      filePath: `/hooks/${name}/HOOK.md`,
      baseDir: `/hooks/${name}`,
      handlerPath: `/hooks/${name}/handler.ts`,
    },
    metadata: { events: ["test:event"], emoji: "🔧" },
  };
}

describe("hooks-status", () => {
  it("builds a status report with provided entries", () => {
    const entries = [makeEntry("alpha"), makeEntry("beta")];
    const report: HookStatusReport = buildWorkspaceHookStatus("/workspace", { entries });

    expect(report.workspaceDir).toBe("/workspace");
    expect(report.hooks).toHaveLength(2);
    expect(report.hooks[0].name).toBe("alpha");
    expect(report.hooks[0].enabledByConfig).toBe(true);
    expect(report.hooks[0].loadable).toBe(true);
  });

  it("marks plugin hooks as managed", () => {
    const entries = [makeEntry("plugin-hook", "coreblow-plugin")];
    const report = buildWorkspaceHookStatus("/workspace", { entries });

    expect(report.hooks[0].managedByPlugin).toBe(true);
    expect(report.hooks[0].enabledByConfig).toBe(true);
  });

  it("returns empty hooks for no entries", () => {
    const report = buildWorkspaceHookStatus("/workspace");
    expect(report.hooks).toEqual([]);
  });

  it("deduplicates entries by name via resolveHookEntries", () => {
    const entries = [
      makeEntry("greet", "coreblow-bundled"),
      makeEntry("greet", "coreblow-bundled"),
    ];
    const report = buildWorkspaceHookStatus("/workspace", { entries });
    // resolveHookEntries deduplicates
    expect(report.hooks).toHaveLength(1);
  });
});
