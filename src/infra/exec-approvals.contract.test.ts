import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadShellParserContractFixtureCases,
  loadWrapperResolutionContractFixtureCases,
} from "./exec-approvals-test-helpers.js";
import { analyzeShellCommand, resolveCommandResolutionFromArgv } from "./exec-approvals.js";

describe("exec approvals shell parser contract fixture", () => {
  const fixtures = loadShellParserContractFixtureCases();

  it.each(fixtures)("matches fixture: $id", (fixture) => {
    const res = analyzeShellCommand({ command: fixture.command });
    expect(res.ok).toBe(fixture.ok);
    if (!fixture.ok) {
      expect(res.segments).toHaveLength(0);
      return;
    }
    const executables = res.segments.map((segment) =>
      path.basename(segment.argv[0] ?? "").toLowerCase(),
    );
    expect(executables).toEqual(fixture.executables.map((entry) => entry.toLowerCase()));
  });
});

describe("exec approvals wrapper resolution contract fixture", () => {
  const fixtures = loadWrapperResolutionContractFixtureCases();

  it.each(fixtures)("matches wrapper fixture: $id", (fixture) => {
    const resolution = resolveCommandResolutionFromArgv(fixture.argv);
    expect(resolution?.execution.rawExecutable ?? null).toBe(fixture.expectedRawExecutable);
  });
});
