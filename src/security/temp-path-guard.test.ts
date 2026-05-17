import { describe, expect, it } from "vitest";

const { findMessagingTmpdirCallLines } = (await import(
  new URL("../../scripts/check-no-random-messaging-tmp.mjs", import.meta.url).href
)) as unknown as {
  findMessagingTmpdirCallLines: (source: string) => number[];
};

describe("temp-path-guard", () => {
  it("detects namespace os.tmpdir calls in messaging runtime code", () => {
    const lines = findMessagingTmpdirCallLines(
      [
        'import * as os from "node:os";',
        'const root = os.tmpdir();',
        'const literal = "os.tmpdir()";',
      ].join("\n"),
    );

    expect(lines).toEqual([2]);
  });

  it("detects named tmpdir imports", () => {
    const lines = findMessagingTmpdirCallLines(
      ['import { tmpdir as getTmpDir } from "node:os";', "const root = getTmpDir();"].join("\n"),
    );

    expect(lines).toEqual([2]);
  });

  it("ignores static fixtures and unrelated function names", () => {
    const lines = findMessagingTmpdirCallLines(
      [
        'const fixture = "tmpdir()";',
        "function tmpdir() { return '/tmp/example'; }",
        "const root = tmpdir();",
      ].join("\n"),
    );

    expect(lines).toEqual([]);
  });

  it.todo("skips test helper filename variants");
  it.todo("enforces runtime guardrails for tmpdir joins and weak randomness");
});
