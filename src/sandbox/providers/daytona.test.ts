import { describe, expect, it } from "vitest";
import { DaytonaSandboxProvider } from "./daytona.js";

function createMockDaytonaFetch(calls: Array<{ method: string; url: string; body?: unknown }> = []) {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ method, url, body });

    if (method === "POST" && url.endsWith("/sandboxes")) {
      return new Response(JSON.stringify({ id: "daytona-sb-1", state: "running" }), { status: 200 });
    }
    if (method === "POST" && url.endsWith("/sandboxes/daytona-sb-1/files")) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    if (method === "POST" && url.endsWith("/sandboxes/daytona-sb-1/exec")) {
      return new Response(
        JSON.stringify({
          exitCode: 0,
          stdout: "hello daytona token=sk-secret1234567890abcdef ghp_1234567890abcdefghij1234567890abcdef",
          stderr: "",
        }),
        { status: 200 },
      );
    }
    if (method === "POST" && url.endsWith("/sandboxes/daytona-sb-1/files/read")) {
      return new Response(
        JSON.stringify({ files: [{ path: "out.txt", content: "artifact-ok" }] }),
        { status: 200 },
      );
    }
    if (method === "POST" && url.endsWith("/sandboxes/daytona-sb-1/pause")) {
      return new Response(JSON.stringify({ state: "paused" }), { status: 200 });
    }
    if (method === "POST" && url.endsWith("/sandboxes/daytona-sb-1/resume")) {
      return new Response(JSON.stringify({ state: "running" }), { status: 200 });
    }
    if (method === "DELETE" && url.endsWith("/sandboxes/daytona-sb-1")) {
      return new Response(null, { status: 204 });
    }
    return new Response("Not Found", { status: 404 });
  }) as typeof fetch;
}

describe("DaytonaSandboxProvider", () => {
  it("executes full persistent session lifecycle and redacts secrets", async () => {
    const calls: Array<{ method: string; url: string; body?: unknown }> = [];
    const provider = new DaytonaSandboxProvider({
      apiKey: "daytona-test-key-9999",
      apiUrl: "https://daytona.mock.local/api",
      fetchImpl: createMockDaytonaFetch(calls),
    });

    expect(provider.isConfigured()).toBe(true);
    const session = await provider.create({ template: "node-22" });
    expect(session.handle.id).toBe("daytona-sb-1");
    expect(session.handle.provider).toBe("daytona");
    expect(session.handle.state).toBe("running");

    await session.syncFilesToSandbox([{ path: "src/index.ts", content: "console.log(1);" }]);
    const execRes = await session.exec("node src/index.ts");
    expect(execRes.success).toBe(true);
    expect(execRes.exitCode).toBe(0);
    expect(execRes.output).toContain("hello daytona");
    expect(execRes.output).not.toContain("sk-secret1234567890abcdef");
    expect(execRes.output).not.toContain("ghp_1234567890abcdefghij1234567890abcdef");
    expect(execRes.output).toContain("[REDACTED]");

    const syncedBack = await session.syncFilesFromSandbox(["out.txt"]);
    expect(syncedBack).toEqual([{ path: "out.txt", content: "artifact-ok" }]);

    const paused = await session.pause();
    expect(paused.state).toBe("paused");
    const resumed = await session.resume();
    expect(resumed.state).toBe("running");

    await session.destroy();
    expect(session.handle.state).toBe("destroyed");
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST https://daytona.mock.local/api/sandboxes",
      "POST https://daytona.mock.local/api/sandboxes/daytona-sb-1/files",
      "POST https://daytona.mock.local/api/sandboxes/daytona-sb-1/exec",
      "POST https://daytona.mock.local/api/sandboxes/daytona-sb-1/files/read",
      "POST https://daytona.mock.local/api/sandboxes/daytona-sb-1/pause",
      "POST https://daytona.mock.local/api/sandboxes/daytona-sb-1/resume",
      "DELETE https://daytona.mock.local/api/sandboxes/daytona-sb-1",
    ]);
  });

  it("fails closed when DAYTONA_API_KEY is missing", async () => {
    const prev = process.env.DAYTONA_API_KEY;
    delete process.env.DAYTONA_API_KEY;
    try {
      const provider = new DaytonaSandboxProvider({ apiKey: "" });
      expect(provider.isConfigured()).toBe(false);
      await expect(provider.create()).rejects.toThrow(/DAYTONA_API_KEY_MISSING/);
    } finally {
      if (prev !== undefined) process.env.DAYTONA_API_KEY = prev;
    }
  });

  it("propagates HTTP 401/500 errors and timeout aborts cleanly", async () => {
    const errProvider = new DaytonaSandboxProvider({
      apiKey: "daytona-secret-xyz",
      fetchImpl: (async () => new Response("Unauthorized daytona-secret-xyz", { status: 401 })) as typeof fetch,
    });
    await expect(errProvider.create()).rejects.toThrow(/401.*\[REDACTED\]/);

    const abortProvider = new DaytonaSandboxProvider({
      apiKey: "daytona-secret-xyz",
      fetchImpl: (async (_url, init) => {
        if (String(_url).endsWith("/sandboxes")) {
          return new Response(JSON.stringify({ id: "sb-timeout" }), { status: 200 });
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
    const provider = new DaytonaSandboxProvider({
      apiKey: "daytona-test-key",
      fetchImpl: createMockDaytonaFetch(),
    });
    const session = await provider.create();
    await expect(
      session.syncFilesToSandbox([{ path: "../etc/passwd", content: "bad" }]),
    ).rejects.toThrow(/Path traversal/);
    await expect(
      session.syncFilesFromSandbox(["/etc/shadow"]),
    ).rejects.toThrow(/Absolute host paths/);
  });
});
