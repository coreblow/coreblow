import { describe, it, expect } from "vitest";
import { MiddlewareChain } from "./middleware-chain.js";

describe("MiddlewareChain", () => {
  it("executes middlewares in order with next()", async () => {
    const chain = new MiddlewareChain();
    const order: string[] = [];

    chain.use("first", async (ctx, next) => { order.push("first-before"); await next(); order.push("first-after"); });
    chain.use("second", async (ctx, next) => { order.push("second-before"); await next(); order.push("second-after"); });

    const ctx = chain.createContext("GET", "/test");
    await chain.execute(ctx);

    expect(order).toEqual(["first-before", "second-before", "second-after", "first-after"]);
  });

  it("creates default context with 200 status", () => {
    const chain = new MiddlewareChain();
    const ctx = chain.createContext("POST", "/api/data", { "content-type": "application/json" });

    expect(ctx.request.method).toBe("POST");
    expect(ctx.request.path).toBe("/api/data");
    expect(ctx.response.status).toBe(200);
    expect(ctx.state).toEqual({});
  });

  it("filters middleware by path prefix", async () => {
    const chain = new MiddlewareChain();
    const executed: string[] = [];

    chain.use("global", async (_ctx, next) => { executed.push("global"); await next(); });
    chain.use("api-only", async (_ctx, next) => { executed.push("api-only"); await next(); }, "/api");
    chain.use("admin-only", async (_ctx, next) => { executed.push("admin-only"); await next(); }, "/admin");

    const ctx = chain.createContext("GET", "/api/test");
    await chain.execute(ctx);

    expect(executed).toContain("global");
    expect(executed).toContain("api-only");
    expect(executed).not.toContain("admin-only");
  });

  it("handles errors by setting 500 status", async () => {
    const chain = new MiddlewareChain();
    chain.use("erroring", async () => { throw new Error("middleware crash"); });

    const ctx = chain.createContext("GET", "/test");
    const result = await chain.execute(ctx);

    expect(result.response.status).toBe(500);
    expect((result.response.body as any).error).toBe("middleware crash");
  });

  it("tracks execution stats including errors", async () => {
    const chain = new MiddlewareChain();
    chain.use("ok", async (_ctx, next) => { await next(); });

    await chain.execute(chain.createContext("GET", "/test"));
    expect(chain.getStats().executed).toBe(1);
    expect(chain.getStats().errors).toBe(0);

    chain.use("fail", async () => { throw new Error("fail"); });
    await chain.execute(chain.createContext("GET", "/test"));
    expect(chain.getStats().executed).toBe(2);
    expect(chain.getStats().errors).toBe(1);
  });

  it("allows state sharing across middlewares", async () => {
    const chain = new MiddlewareChain();
    chain.use("setter", async (ctx, next) => { ctx.state.userId = "user123"; await next(); });
    chain.use("reader", async (ctx, next) => { ctx.response.body = { user: ctx.state.userId }; await next(); });

    const ctx = chain.createContext("GET", "/test");
    const result = await chain.execute(ctx);
    expect((result.response.body as any).user).toBe("user123");
  });

  it("lists and counts middlewares", () => {
    const chain = new MiddlewareChain();
    expect(chain.count()).toBe(0);

    chain.use("a", async (_ctx, next) => { await next(); });
    chain.use("b", async (_ctx, next) => { await next(); }, "/api");

    expect(chain.count()).toBe(2);
    expect(chain.list()).toEqual([
      { name: "a", path: undefined },
      { name: "b", path: "/api" },
    ]);
  });
});
