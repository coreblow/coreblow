import { describe, expect, it, vi } from "vitest";
import { loadSqliteVecExtension } from "./sqlite-vec.js";

describe("loadSqliteVecExtension", () => {
  it("loads an explicit extension path without importing bundled sqlite-vec", async () => {
    const db = {
      enableLoadExtension: vi.fn(),
      loadExtension: vi.fn(),
    };

    const result = await loadSqliteVecExtension({
      db: db as never,
      extensionPath: "/tmp/vec0.dylib",
    });

    expect(result).toEqual({ ok: true, extensionPath: "/tmp/vec0.dylib" });
    expect(db.enableLoadExtension).toHaveBeenCalledWith(true);
    expect(db.loadExtension).toHaveBeenCalledWith("/tmp/vec0.dylib");
  });
});
