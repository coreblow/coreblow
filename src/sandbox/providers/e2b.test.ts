import { describe, expect, it } from "vitest";
import { E2BSandboxProvider } from "./e2b.js";

function createMockE2BFetch(calls: Array<{ method: string; url: string; headers?: HeadersInit; body?: unknown }> = []) {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ method, url, headers: init?.headers, body });

    if (method === "POST" && url.endsWith("/sandboxes")) {
      return new Response(JSON.stringify({ sandboxID: "e2b-sb-1", state: "running" }), { status: 200 });
    }
    if (method === "POST" && url.endsWith("/sandboxes/e2b-sb-1/files")) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    if (method === "POST" && url.endsWith("/sandboxes/e2b-sb-1/commands")) {
      return new Response(
        JSON.stringify({
          exitCode: 0,
          stdout: "hello e2b Bearer super-secret-jwt-token-123456",
          stderr: "",
        }),
        { status: 200 },
      );
    }
    if (method === "POST" && url.endsWith("/sandboxes/e2b-sb-1/files/read")) {
      return new Response(
        JSON.stringify({ files: [{ path: "result.json", content: "{\"ok\":true}" }] }),
        { status: 200 },
      );
    }
    if (method === "POST" && url.endsWith("/sandboxes/e2b-sb-1/pause")) {
      return new Response(JSON.stringify({ state: "paused" }), { status: 200 });
    }
    if (method === "POST" && url.endsWith("/sandboxes/e2b-sb-1/resume")) {
      return new Response(JSON.stringify({ state: "running" }), { status: 200 });
    }
    if (method === "DELETE" && url.endsWith("/sandboxes/e2b-sb-1")) {
      return new Response(null, { status: 204 });
    }
    return new Response("Not Found", { status: 404 });
  }) as typeof fetch;
}

describe("E2BSandboxProvider", () => {
  it("executes full persistent session lifecycle and redacts secrets", async () => {
    const calls: Array<{ method: string; url: string; headers?: HeadersInit; body?: unknown }> = [];
    const provider = new E2BSandboxProvider({
      apiKey: "e2b-test-key-9999",
      apiUrl: "https://e2b.mock.local",
      fetchImpl: createMockE2BFetch(calls),
    });

    expect(provider.isConfigured()).toBe(true);
    const session = await provider.create({ template: "python-3.12" });
    expect(session.handle.id).toBe("e2b-sb-1");
    expect(session.handle.provider).toBe("e2b");
    expect(session.handle.state).toBe("running");

    await session.syncFilesToSandbox([{ path: "app.py", content: "print('hi')" }]);
    const execRes = await session.exec("python app.py");
    expect(execRes.success).toBe(true);
    expect(execRes.exitCode).toBe(0);
    expect(execRes.output).toContain("hello e2b");
    expect(execRes.output).not.toContain("super-secret-jwt-token-123456");
    expect(execRes.output).toContain("[REDACTED]");

    const syncedBack = await session.syncFilesFromSandbox(["result.json"]);
    expect(syncedBack).toEqual([{ path: "result.json", content: "{\"ok\":true}" }]);

    const paused = await session.pause();
    expect(paused.state).toBe("paused");
    const resumed = await session.resume();
    expect(resumed.state).toBe("running");

    await session.destroy();
    expect(session.handle.state).toBe("destroyed");
    expect(calls[0]?.headers).toMatchObject({ "X-API-Key": "e2b-test-key-9999" });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST https://e2b.mock.local/sandboxes",
      "POST https://e2b.mock.local/sandboxes/e2b-sb-1/files",
      "POST https://e2b.mock.local/sandboxes/e2b-sb-1/commands",
      "POST https://e2b.mock.local/sandboxes/e2b-sb-1/files/read",
      "POST https://e2b.mock.local/sandboxes/e2b-sb-1/pause",
      "POST https://e2b.mock.local/sandboxes/e2b-sb-1/resume",
      "DELETE https://e2b.mock.local/sandboxes/e2b-sb-1",
    ]);
  });

  it("fails closed when E2B_API_KEY is missing", async () => {
    const prev = process.env.E2B_API_KEY;
    delete process.env.E2B_API_KEY;
    try {
      const provider = new E2BSandboxProvider({ apiKey: "" });
      expect(provider.isConfigured()).toBe(false);
      await expect(provider.create()).rejects.toThrow(/E2B_API_KEY_MISSING/);
    } finally {
      if (prev !== undefined) process.env.E2B_API_KEY = prev;
    }
  });

  it("propagates HTTP 500 errors and timeout aborts cleanly", async () => {
    const errProvider = new E2BSandboxProvider({
      apiKey: "e2b-secret-xyz",
      fetchImpl: (async () => new Response("Internal error e2b-secret-xyz", { status: 500 })) as typeof fetch,
    });
    await expect(errProvider.create()).rejects.toThrow(/500.*\[REDACTED\]/);

    const abortProvider = new E2BSandboxProvider({
      apiKey: "e2b-secret-xyz",
      fetchImpl: (async (_url, init) => {
        if (String(_url).endsWith("/sandboxes")) {
          return new Response(JSON.stringify({ sandboxID: "e2b-timeout" }), { status: 200 });
        }
        expect(init?.signal).toBeDefined();
        throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
      }) as typeof fetch,
    });
    const session = await abortProvider.create();
    const res = await session.exec("sleep 60", { timeoutMs: 150 });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/aborted|timeout/i);
  });

  it("rejects path traversal and absolute host paths on file sync", async () => {
    const provider = new E2BSandboxProvider({
      apiKey: "e2b-test-key",
      fetchImpl: createMockE2BFetch(),
    });
    const session = await provider.create();
    await expect(
      session.syncFilesToSandbox([{ path: "../../secret.env", content: "bad" }]),
    ).rejects.toThrow(/Path traversal/);
    await expect(
      session.syncFilesFromSandbox(["/etc/passwd"]),
    ).rejects.toThrow(/Absolute host paths/);
  });
});
