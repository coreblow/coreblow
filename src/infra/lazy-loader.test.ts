/**
 * src/infra/lazy-loader.test.ts
 *
 * CoreBlow — Lazy Loader Tests
 * Verifies LazyLoader: register, get, caching, error propagation.
 */
import { describe, beforeEach, expect, it } from "vitest";
import { LazyLoader } from "./lazy-loader.js";

let loader: LazyLoader;

beforeEach(() => {
  loader = new LazyLoader();
});

describe("LazyLoader — construction", () => {
  it("constructs without throwing", () => {
    expect(() => new LazyLoader()).not.toThrow();
  });
});

describe("LazyLoader.register()", () => {
  it("registers a resource without throwing", () => {
    expect(() =>
      loader.register("myRes", async () => ({ value: 42 }))
    ).not.toThrow();
  });

  it("registers multiple resources without conflict", () => {
    expect(() => {
      loader.register("res-a", async () => "A");
      loader.register("res-b", async () => "B");
    }).not.toThrow();
  });
});

describe("LazyLoader.get()", () => {
  it("returns null for unknown resource", async () => {
    const result = await loader.get("nonexistent");
    expect(result).toBeNull();
  });

  it("loads and returns registered resource", async () => {
    loader.register("token", async () => "coreblow-token");
    const result = await loader.get<string>("token");
    expect(result).toBe("coreblow-token");
  });

  it("caches result on second get (calls factory only once)", async () => {
    let callCount = 0;
    loader.register("cached", async () => {
      callCount++;
      return "value";
    });
    await loader.get("cached");
    await loader.get("cached");
    expect(callCount).toBe(1);
  });

  it("throws when factory throws (no silent catch)", async () => {
    loader.register("broken", async () => {
      throw new Error("load failed");
    });
    await expect(loader.get("broken")).rejects.toThrow("load failed");
  });

  it("returns complex object from factory", async () => {
    const obj = { name: "CoreBlow", version: "1.0" };
    loader.register("config", async () => obj);
    const result = await loader.get("config");
    expect(result).toEqual(obj);
  });
});
