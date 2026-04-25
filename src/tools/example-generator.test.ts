import { describe, beforeEach, expect, it } from "vitest";
import { ExampleGenerator } from "./example-generator.js";

let gen: ExampleGenerator;

beforeEach(() => {
    gen = new ExampleGenerator();
});

describe("ExampleGenerator — toCurl", () => {
    it("generates a basic GET cURL command", () => {
        const curl = gen.toCurl({ method: "GET", path: "/api/health" });
        expect(curl).toContain("curl -X GET");
        expect(curl).toContain("localhost:3100/api/health");
        expect(curl).toContain("Content-Type: application/json");
    });

    it("includes request body for POST", () => {
        const curl = gen.toCurl({
            method: "POST",
            path: "/api/chat",
            body: { message: "hello" },
        });
        expect(curl).toContain("curl -X POST");
        expect(curl).toContain("-d '");
        expect(curl).toContain('"message":"hello"');
    });

    it("uses custom baseUrl", () => {
        const curl = gen.toCurl({
            method: "GET",
            path: "/v2/status",
            baseUrl: "https://api.example.com",
        });
        expect(curl).toContain("https://api.example.com/v2/status");
    });

    it("includes custom headers", () => {
        const curl = gen.toCurl({
            method: "GET",
            path: "/api",
            headers: { Authorization: "Bearer token123" },
        });
        expect(curl).toContain("Authorization: Bearer token123");
    });
});

describe("ExampleGenerator — toFetch", () => {
    it("generates a fetch snippet", () => {
        const snippet = gen.toFetch({ method: "GET", path: "/api/test" });
        expect(snippet).toContain("await fetch(");
        expect(snippet).toContain("localhost:3100/api/test");
        expect(snippet).toContain("method: 'GET'");
    });

    it("includes body for POST requests", () => {
        const snippet = gen.toFetch({
            method: "POST",
            path: "/api/data",
            body: { key: "value" },
        });
        expect(snippet).toContain("body: JSON.stringify(");
    });
});

describe("ExampleGenerator — toPython", () => {
    it("generates a Python requests snippet", () => {
        const snippet = gen.toPython({ method: "GET", path: "/api/info" });
        expect(snippet).toContain("import requests");
        expect(snippet).toContain("requests.get(");
        expect(snippet).toContain("response.json()");
    });

    it("uses json param for POST body", () => {
        const snippet = gen.toPython({
            method: "POST",
            path: "/api/create",
            body: { name: "test" },
        });
        expect(snippet).toContain("requests.post(");
        expect(snippet).toContain("json=");
    });
});

describe("ExampleGenerator — toMarkdown", () => {
    it("generates markdown with cURL, JS, and Python blocks", () => {
        const md = gen.toMarkdown({ method: "GET", path: "/api/v1" });
        expect(md).toContain("#### cURL");
        expect(md).toContain("#### JavaScript");
        expect(md).toContain("#### Python");
    });

    it("includes response block when provided", () => {
        const md = gen.toMarkdown({
            method: "GET",
            path: "/api",
            response: { status: "ok" },
        });
        expect(md).toContain("#### Response");
        expect(md).toContain('"status": "ok"');
    });
});

describe("ExampleGenerator — setDefaults", () => {
    it("overrides default baseUrl", () => {
        gen.setDefaults("https://custom.api");
        const curl = gen.toCurl({ method: "GET", path: "/ping" });
        expect(curl).toContain("https://custom.api/ping");
    });

    it("overrides default headers", () => {
        gen.setDefaults("http://localhost", { "X-Api-Key": "secret" });
        const curl = gen.toCurl({ method: "GET", path: "/" });
        expect(curl).toContain("X-Api-Key: secret");
        // Original Content-Type should be gone since headers were replaced
        expect(curl).not.toContain("Content-Type");
    });
});
