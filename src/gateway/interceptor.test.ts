import { describe, it, expect } from "vitest";
import { RequestInterceptor } from "./interceptor.js";

describe("RequestInterceptor", () => {
  it("creates request with auto-generated id and uppercase method", () => {
    const interceptor = new RequestInterceptor();
    const req = interceptor.createRequest("get", "/api/test", { "user-agent": "test/1.0" });

    expect(req.id).toBeTruthy();
    expect(req.method).toBe("GET");
    expect(req.path).toBe("/api/test");
    expect(req.userAgent).toBe("test/1.0");
    expect(req.timestamp).toBeGreaterThan(0);
  });

  it("extracts ip from x-forwarded-for header", () => {
    const interceptor = new RequestInterceptor();
    const req = interceptor.createRequest("post", "/api", { "x-forwarded-for": "1.2.3.4" });
    expect(req.ip).toBe("1.2.3.4");
  });

  it("processes request through hooks in order", () => {
    const interceptor = new RequestInterceptor();

    interceptor.onRequest("add-header", (req) => ({
      ...req,
      headers: { ...req.headers, "x-custom": "added" },
    }));

    const req = interceptor.createRequest("get", "/test");
    const processed = interceptor.processRequest(req);
    expect(processed).not.toBeNull();
    expect(processed!.headers["x-custom"]).toBe("added");
  });

  it("blocks request when hook returns null", () => {
    const interceptor = new RequestInterceptor();

    interceptor.onRequest("blocker", () => null);
    interceptor.onRequest("should-not-run", (req) => ({ ...req, path: "/mutated" }));

    const req = interceptor.createRequest("get", "/blocked");
    const processed = interceptor.processRequest(req);
    expect(processed).toBeNull();
  });

  it("processes response through hooks and logs entry", () => {
    const interceptor = new RequestInterceptor();

    interceptor.onResponse("add-header", (_req, res) => ({
      ...res,
      headers: { ...res.headers, "x-powered-by": "CoreBlow" },
    }));

    const req = interceptor.createRequest("get", "/test");
    const res = interceptor.processResponse(req, {
      status: 200,
      headers: {},
      body: "ok",
      durationMs: 42,
    });

    expect(res.headers["x-powered-by"]).toBe("CoreBlow");

    const log = interceptor.getLog();
    expect(log).toHaveLength(1);
    expect(log[0].status).toBe(200);
    expect(log[0].durationMs).toBe(42);
  });

  it("limits log size to maxLog", () => {
    const interceptor = new RequestInterceptor();

    // Process 1005 responses (default maxLog is 1000)
    for (let i = 0; i < 1005; i++) {
      const req = interceptor.createRequest("get", `/test/${i}`);
      interceptor.processResponse(req, { status: 200, headers: {}, durationMs: 1 });
    }

    const log = interceptor.getLog(2000);
    expect(log.length).toBeLessThanOrEqual(1000);
  });

  it("getLog respects limit parameter", () => {
    const interceptor = new RequestInterceptor();

    for (let i = 0; i < 10; i++) {
      const req = interceptor.createRequest("get", `/test/${i}`);
      interceptor.processResponse(req, { status: 200, headers: {}, durationMs: 1 });
    }

    expect(interceptor.getLog(3)).toHaveLength(3);
    expect(interceptor.getLog()).toHaveLength(10); // default 50, but only 10 exist
  });

  it("computes stats correctly", () => {
    const interceptor = new RequestInterceptor();

    const mkReqRes = (status: number, duration: number) => {
      const req = interceptor.createRequest("get", "/test");
      interceptor.processResponse(req, { status, headers: {}, durationMs: duration });
    };

    mkReqRes(200, 10);
    mkReqRes(200, 20);
    mkReqRes(404, 30);
    mkReqRes(500, 40);

    const stats = interceptor.getStats();
    expect(stats.totalRequests).toBe(4);
    expect(stats.avgDurationMs).toBe(25);
    expect(stats.statusCodes[200]).toBe(2);
    expect(stats.statusCodes[404]).toBe(1);
    expect(stats.statusCodes[500]).toBe(1);
  });

  it("lists registered hooks", () => {
    const interceptor = new RequestInterceptor();
    interceptor.onRequest("auth", (req) => req);
    interceptor.onRequest("logging", (req) => req);
    interceptor.onResponse("cors", (_req, res) => res);

    const hooks = interceptor.listHooks();
    expect(hooks.request).toEqual(["auth", "logging"]);
    expect(hooks.response).toEqual(["cors"]);
  });
});
