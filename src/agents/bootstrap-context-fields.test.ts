import { describe, expect, it } from "vitest";
import { resolveBootstrapRunContextFields } from "./bootstrap-context-fields.js";
import { buildAgentSystemPrompt } from "./system-prompt.js";
import type { WorkspaceBootstrapFile } from "./workspace.js";

describe("resolveBootstrapRunContextFields", () => {
  it("preserves contextFiles as EmbeddedContextFile[] when deprecated content is a string", () => {
    const bootstrapFiles: WorkspaceBootstrapFile[] = [
      {
        name: "AGENTS.md",
        path: "/tmp/workspace/AGENTS.md",
        content: "# Agents",
        missing: false,
      },
    ];
    const resolved = resolveBootstrapRunContextFields({
      bootstrapFiles,
      contextFiles: [{ path: "AGENTS.md", content: "# Agents" }],
      files: [{ name: "AGENTS.md", path: "/tmp/workspace/AGENTS.md", content: "# Agents" }],
      content: "## AGENTS.md\n\n# Agents",
    });

    expect(resolved.bootstrapFiles).toEqual(bootstrapFiles);
    expect(resolved.contextFiles).toEqual([{ path: "AGENTS.md", content: "# Agents" }]);

    const prompt = buildAgentSystemPrompt({
      workspaceDir: "/tmp/workspace",
      contextFiles: resolved.contextFiles,
    });
    expect(prompt).toContain("# Project Context");
    expect(prompt).toContain("## AGENTS.md");
  });

  it("supports legacy array content mocks and guards non-array contextFiles in buildAgentSystemPrompt", () => {
    const legacy = resolveBootstrapRunContextFields({
      files: [{ name: "SOUL.md", path: "/tmp/workspace/SOUL.md", content: "hi" }],
      content: [{ path: "SOUL.md", content: "hi" }],
    });
    expect(legacy.contextFiles).toEqual([{ path: "SOUL.md", content: "hi" }]);

    expect(() =>
      buildAgentSystemPrompt({
        workspaceDir: "/tmp/workspace",
        contextFiles: "## AGENTS.md\n\nbad string" as unknown as [],
      }),
    ).not.toThrow();
  });
});
