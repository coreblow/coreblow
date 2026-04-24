/**
 * web/api.test.ts
 * Tests for web API response helpers.
 */
import { describe, expect, it } from "vitest";
import { jsonResponse, errorResponse } from "./api.js";

describe("jsonResponse", () => {
  it("returns JSON response with default 200 status", () => {
    const res = jsonResponse({ hello: "world" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
  });

  it("returns custom status code", () => {
    const res = jsonResponse({ created: true }, 201);
    expect(res.status).toBe(201);
  });

  it("serializes body as JSON", async () => {
    const res = jsonResponse({ key: "value", num: 42 });
    const body = await res.json();
    expect(body).toEqual({ key: "value", num: 42 });
  });

  it("handles arrays", async () => {
    const res = jsonResponse([1, 2, 3]);
    const body = await res.json();
    expect(body).toEqual([1, 2, 3]);
  });

  it("handles null", async () => {
    const res = jsonResponse(null);
    const body = await res.json();
    expect(body).toBeNull();
  });
});

describe("errorResponse", () => {
  it("returns error with default 500 status", async () => {
    const res = errorResponse("Something went wrong");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Something went wrong");
  });

  it("returns error with custom status", async () => {
    const res = errorResponse("Not found", 404);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Not found");
  });
});
