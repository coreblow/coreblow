import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractApplyPatchTargetPaths } from "./apply-patch-paths.js";

const defaultCwd = process.cwd();
const cwdPath = (...segments: string[]) => path.join(defaultCwd, ...segments);

describe("extractApplyPatchTargetPaths", () => {
  it("returns an empty array for non-string input", () => {
    expect(extractApplyPatchTargetPaths(undefined)).toEqual([]);
    expect(extractApplyPatchTargetPaths(null)).toEqual([]);
    expect(extractApplyPatchTargetPaths(42)).toEqual([]);
    expect(extractApplyPatchTargetPaths({})).toEqual([]);
    expect(extractApplyPatchTargetPaths({ input: 7 })).toEqual([]);
  });

  it("extracts add, update, delete, and move targets", () => {
    const patch = [
      "*** Begin Patch",
      "*** Add File: src/new.ts",
      "+export const value = 1;",
      "*** Update File: old/path.ts",
      "*** Move to: new/path.ts",
      "@@",
      " context",
      "+added",
      "*** Delete File: dead.ts",
      "*** End Patch",
    ].join("\n");

    expect(extractApplyPatchTargetPaths(patch)).toEqual([
      cwdPath("src/new.ts"),
      cwdPath("old/path.ts"),
      cwdPath("new/path.ts"),
      cwdPath("dead.ts"),
    ]);
  });

  it("accepts the wrapper object form used by the apply_patch tool", () => {
    const patch = ["*** Begin Patch", "*** Add File: foo.ts", "+x", "*** End Patch"].join("\n");
    expect(extractApplyPatchTargetPaths({ input: patch })).toEqual([cwdPath("foo.ts")]);
  });

  it("normalizes and de-duplicates repeated paths", () => {
    const patch = [
      "*** Begin Patch",
      "*** Add File: safe/../secret.ts",
      "+x",
      "*** Update File: ./src//old.ts",
      "*** Move to: src/temp/../renamed.ts",
      "@@",
      "+y",
      "*** Delete File: secret.ts",
      "*** End Patch",
    ].join("\n");

    expect(extractApplyPatchTargetPaths(patch)).toEqual([
      cwdPath("secret.ts"),
      cwdPath("src/old.ts"),
      cwdPath("src/renamed.ts"),
    ]);
  });

  it("ignores marker-like body lines inside update hunks", () => {
    const patch = [
      "*** Begin Patch",
      "*** Update File: real.ts",
      "@@",
      " *** Add File: fake-context.ts",
      "  *** Delete File: fake-indented-context.ts",
      "-*** Delete File: fake-remove.ts",
      "+*** Add File: fake-add.ts",
      "*** End Patch",
    ].join("\n");

    expect(extractApplyPatchTargetPaths(patch)).toEqual([cwdPath("real.ts")]);
  });

  it("uses apply_patch cwd, tilde, and at-prefix path semantics", () => {
    const cwd = path.join(os.tmpdir(), "coreblow-derived-paths");
    const patch = [
      "*** Begin Patch",
      "*** Add File: @src/../resolved.ts",
      "+x",
      "*** Update File: ~/renamed-source.ts",
      "*** Move to: /tmp/coreblow-target.ts",
      "@@",
      "+y",
      "*** End Patch",
    ].join("\n");

    expect(extractApplyPatchTargetPaths(patch, { cwd })).toEqual([
      path.join(cwd, "resolved.ts"),
      path.join(os.homedir(), "renamed-source.ts"),
      path.join("/tmp", "coreblow-target.ts"),
    ]);
  });

  it("skips sandbox paths rejected by the bridge", () => {
    const patch = [
      "*** Begin Patch",
      "*** Add File: /workspace/src/ok.ts",
      "+x",
      "*** Add File: /outside.ts",
      "+y",
      "*** End Patch",
    ].join("\n");

    expect(
      extractApplyPatchTargetPaths(patch, {
        cwd: "/workspace",
        sandbox: {
          root: "/workspace",
          bridge: {
            resolvePath: ({ filePath }: { filePath: string }) => {
              if (filePath === "/outside.ts") {
                throw new Error("Path escapes sandbox root");
              }
              return {
                containerPath: filePath,
                hostPath: filePath.replace("/workspace", "/host/workspace"),
                relativePath: filePath.replace("/workspace/", ""),
              };
            },
          } as never,
        },
      }),
    ).toEqual(["/host/workspace/src/ok.ts"]);
  });

  it("does not require begin or end envelope markers to be present", () => {
    const patch = ["*** Add File: loose.ts", "+x"].join("\n");
    expect(extractApplyPatchTargetPaths(patch)).toEqual([cwdPath("loose.ts")]);
  });
});
