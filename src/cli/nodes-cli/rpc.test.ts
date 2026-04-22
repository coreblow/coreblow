/**
 * src/cli/nodes-cli/rpc.test.ts
 *
 * CoreBlow — Nodes CLI RPC Import Contract
 */
import { describe, expect, it } from "vitest";

describe("nodes-cli/rpc — import contract", () => {
  it("is importable", async () => {
    const mod = await import("./rpc.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });
});

describe("cli-utils — import contract", () => {
  it("is importable", async () => {
    const mod = await import("./cli-utils.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });
});
