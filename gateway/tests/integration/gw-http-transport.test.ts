/**
 * Phase 25 — Test 12: Gateway HTTP Transport
 * Tests HTTP utilities, auth helpers, endpoint registration, and route matching.
 */
import { describe, it, expect } from "vitest";
import { sendJsonResponse, sendErrorResponse } from "../../src/gateway/http-utils.js";
import { extractBearerToken, validateHttpAuth } from "../../src/gateway/http-auth-helpers.js";
import { createEndpoint } from "../../src/gateway/http-endpoint-helpers.js";
import { httpEndpoints, handleHttpRequest } from "../../src/gateway/server-http.js";

// Mock ServerResponse
function createMockRes() {
    let status = 0;
    let headers: Record<string, string> = {};
    let body = "";
    return {
        writeHead(code: number, hdrs: Record<string, string>) { status = code; headers = hdrs; },
        end(data?: string) { body = data || ""; },
        getStatus: () => status,
        getHeaders: () => headers,
        getBody: () => body,
    };
}

// Mock IncomingMessage
function createMockReq(opts: { url?: string; method?: string; headers?: Record<string, string> } = {}) {
    return {
        url: opts.url || "/",
        method: opts.method || "GET",
        headers: { host: "localhost", ...opts.headers },
    };
}

describe("GW HTTP Transport — Full Integration", () => {

    // ── Bearer Token ──
    describe("HTTP Auth Helpers", () => {
        it("extractBearerToken extracts valid token", () => {
            const req = createMockReq({ headers: { authorization: "Bearer my-secret-token" } });
            expect(extractBearerToken(req as any)).toBe("my-secret-token");
        });

        it("extractBearerToken returns null for missing header", () => {
            const req = createMockReq();
            expect(extractBearerToken(req as any)).toBeNull();
        });

        it("extractBearerToken returns null for non-Bearer auth", () => {
            const req = createMockReq({ headers: { authorization: "Basic dXNlcjpwYXNz" } });
            expect(extractBearerToken(req as any)).toBeNull();
        });

        it("validateHttpAuth succeeds with matching token", () => {
            const req = createMockReq({ headers: { authorization: "Bearer correct" } });
            expect(validateHttpAuth(req as any, "correct")).toBe(true);
        });

        it("validateHttpAuth fails with wrong token", () => {
            const req = createMockReq({ headers: { authorization: "Bearer wrong" } });
            expect(validateHttpAuth(req as any, "correct")).toBe(false);
        });
    });

    // ── JSON Response ──
    describe("HTTP Utils", () => {
        it("sendJsonResponse sets Content-Type and status", () => {
            const res = createMockRes();
            sendJsonResponse(res as any, 200, { ok: true });
            expect(res.getStatus()).toBe(200);
            expect(res.getHeaders()["Content-Type"]).toBe("application/json");
            expect(JSON.parse(res.getBody())).toEqual({ ok: true });
        });

        it("sendErrorResponse formats error correctly", () => {
            const res = createMockRes();
            sendErrorResponse(res as any, 404, "not found");
            expect(res.getStatus()).toBe(404);
            const body = JSON.parse(res.getBody());
            expect(body.error.message).toBe("not found");
            expect(body.error.code).toBe(404);
        });
    });

    // ── Endpoint Registration ──
    describe("Endpoint Helpers", () => {
        it("createEndpoint builds valid endpoint", () => {
            const ep = createEndpoint("GET", "/test", () => {});
            expect(ep.method).toBe("GET");
            expect(ep.pathPrefix).toBe("/test");
            expect(typeof ep.handler).toBe("function");
        });
    });

    // ── HTTP Route Matching ──
    describe("Server HTTP Routing", () => {
        it("httpEndpoints has registered endpoints", () => {
            expect(httpEndpoints.length).toBeGreaterThanOrEqual(3);
        });

        it("routes /v1/models to models endpoint", () => {
            const res = createMockRes();
            const req = createMockReq({ url: "/v1/models", method: "GET" });
            handleHttpRequest(req as any, res as any);
            expect(res.getStatus()).toBe(200);
            const body = JSON.parse(res.getBody());
            expect(body.object).toBe("list");
            expect(body.data.length).toBeGreaterThan(0);
        });

        it("returns 404 for unknown routes", () => {
            const res = createMockRes();
            const req = createMockReq({ url: "/unknown/path" });
            handleHttpRequest(req as any, res as any);
            expect(res.getStatus()).toBe(404);
        });

        it("routes DELETE /api/sessions/ to kill endpoint", () => {
            const res = createMockRes();
            const req = createMockReq({ url: "/api/sessions/abc-123", method: "DELETE" });
            handleHttpRequest(req as any, res as any);
            expect(res.getStatus()).toBe(200);
        });

        it("routes GET /api/sessions/ for history", () => {
            const res = createMockRes();
            const req = createMockReq({ url: "/api/sessions/abc-123/history", method: "GET" });
            handleHttpRequest(req as any, res as any);
            expect(res.getStatus()).toBe(200);
        });
    });
});
