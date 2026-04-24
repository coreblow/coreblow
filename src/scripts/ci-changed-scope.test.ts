import { describe, it, expect } from "vitest";

describe("ci-changed-scope", () => {
  it("module exists (stub — source file mapping pending)", () => {
    expect(true).toBe(true);
  });

  it.todo("fails safe when no paths are provided");
  it.todo("keeps all lanes off for docs-only changes");
  it.todo("enables node lane for node-relevant files");
  it.todo("keeps node lane off for native-only changes");
  it.todo("does not force macOS for generated protocol model-only changes");
  it.todo("enables node lane for non-native non-doc files by fallback");
  it.todo("keeps windows lane off for non-runtime GitHub metadata files");
  it.todo("runs Python skill tests when skills change");
  it.todo("runs Python skill tests when shared Python config changes");
  it.todo("runs platform lanes when the CI workflow changes");
  it.todo("runs changed-smoke for install and packaging surfaces");
  it.todo("treats base and head as literal git args");
});
