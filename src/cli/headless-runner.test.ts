import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Readable } from "node:stream";
import {
  parseHeadlessArgs,
  readStreamWithLimit,
  runHeadlessExecution,
} from "./headless-runner.js";

describe("headless-runner", () => {
  describe("parseHeadlessArgs", () => {
    it("parses -p and --print flags", () => {
      const args1 = ["node", "coreblow", "-p", "review diff"];
      expect(parseHeadlessArgs(args1).prompt).toBe("review diff");

      const args2 = ["node", "coreblow", "--print=analyze code"];
      expect(parseHeadlessArgs(args2).prompt).toBe("analyze code");
    });

    it("parses -q and --query flags", () => {
      const args1 = ["node", "coreblow", "-q", "explain this"];
      expect(parseHeadlessArgs(args1).prompt).toBe("explain this");
    });

    it("parses ask primary command", () => {
      const args = ["node", "coreblow", "ask", "what", "is", "this"];
      expect(parseHeadlessArgs(args).prompt).toBe("what is this");
    });

    it("parses output format, model, and flags", () => {
      const args = [
        "node",
        "coreblow",
        "-p",
        "hi",
        "--output-format",
        "json",
        "--model",
        "anthropic/claude-3-7-sonnet",
        "--max-turns",
        "10",
        "--bare",
      ];
      const parsed = parseHeadlessArgs(args);
      expect(parsed.outputFormat).toBe("json");
      expect(parsed.model).toBe("anthropic/claude-3-7-sonnet");
      expect(parsed.maxTurns).toBe(10);
      expect(parsed.bare).toBe(true);
    });
  });

  describe("readStreamWithLimit", () => {
    it("reads full content within limit", async () => {
      const stream = Readable.from(["hello ", "world!"]);
      const content = await readStreamWithLimit(stream, 1024);
      expect(content).toBe("hello world!");
    });

    it("rejects when input exceeds limit", async () => {
      const stream = Readable.from(["a".repeat(100), "b".repeat(100)]);
      await expect(readStreamWithLimit(stream, 50)).rejects.toThrow("exceeds maximum size");
    });
  });

  describe("runHeadlessExecution", () => {
    let stdoutBuffer = "";
    let stderrBuffer = "";
    const origStdoutWrite = process.stdout.write;
    const origStderrWrite = process.stderr.write;

    beforeEach(() => {
      stdoutBuffer = "";
      stderrBuffer = "";
      process.stdout.write = vi.fn((chunk: string | Uint8Array) => {
        stdoutBuffer += chunk.toString();
        return true;
      }) as any;
      process.stderr.write = vi.fn((chunk: string | Uint8Array) => {
        stderrBuffer += chunk.toString();
        return true;
      }) as any;
    });

    afterEach(() => {
      process.stdout.write = origStdoutWrite;
      process.stderr.write = origStderrWrite;
    });

    it("returns exit code 2 when stdin exceeds 10 MB limit", async () => {
      const bigChunk = Buffer.alloc(11 * 1024 * 1024, "x");
      const stream = Readable.from([bigChunk]);

      const res = await runHeadlessExecution({
        prompt: "test",
        stdinStream: stream,
      });

      expect(res.ok).toBe(false);
      expect(res.exitCode).toBe(2);
      expect(stderrBuffer).toContain("exceeds maximum size");
    });

    it("returns exit code 2 when prompt and stdin are missing", async () => {
      const emptyStream = Readable.from([""]);
      const res = await runHeadlessExecution({
        prompt: "",
        stdinStream: emptyStream,
      });

      expect(res.ok).toBe(false);
      expect(res.exitCode).toBe(2);
      expect(stderrBuffer).toContain("Missing prompt");
    });

    it("outputs valid JSON when outputFormat is json", async () => {
      const mockPayload = {
        choices: [
          {
            message: {
              role: "assistant",
              content: "Headless JSON response",
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20 },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockPayload),
        json: async () => mockPayload,
      });

      const res = await runHeadlessExecution({
        prompt: "echo hello",
        outputFormat: "json",
        model: "openai/gpt-4o-mini",
        fetchFn: mockFetch as unknown as typeof fetch,
        stdinStream: Readable.from([""]),
      });

      expect(res.ok).toBe(true);
      expect(res.exitCode).toBe(0);

      // Verify stdout contains ONLY valid JSON
      expect(() => JSON.parse(stdoutBuffer.trim())).not.toThrow();
      const parsed = JSON.parse(stdoutBuffer.trim());
      expect(parsed.ok).toBe(true);
      expect(parsed.result).toBe("Headless JSON response");
      expect(parsed.model).toBe("openai/gpt-4o-mini");
      expect(parsed.usage).toBeDefined();
    });

    it("emits valid NDJSON when outputFormat is stream-json", async () => {
      const mockPayload = {
        choices: [
          {
            message: {
              role: "assistant",
              content: "Streaming response",
            },
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 15 },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockPayload),
        json: async () => mockPayload,
      });

      const res = await runHeadlessExecution({
        prompt: "echo stream",
        outputFormat: "stream-json",
        fetchFn: mockFetch as unknown as typeof fetch,
        stdinStream: Readable.from([""]),
      });

      expect(res.ok).toBe(true);
      const lines = stdoutBuffer.trim().split("\n");
      expect(lines.length).toBeGreaterThanOrEqual(2);

      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }

      const firstObj = JSON.parse(lines[0]!);
      expect(firstObj.type).toBe("init");

      const lastObj = JSON.parse(lines[lines.length - 1]!);
      expect(lastObj.type).toBe("result");
      expect(lastObj.text).toBe("Streaming response");
    });

    it("outputs clean text in default text mode", async () => {
      const mockPayload = {
        choices: [
          {
            message: {
              role: "assistant",
              content: "Plain text response",
            },
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 10 },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockPayload),
        json: async () => mockPayload,
      });

      const res = await runHeadlessExecution({
        prompt: "plain test",
        outputFormat: "text",
        fetchFn: mockFetch as unknown as typeof fetch,
        stdinStream: Readable.from([""]),
      });

      expect(res.ok).toBe(true);
      expect(stdoutBuffer.trim()).toBe("Plain text response");
    });
  });
});
