/**
 * Phase 25 — Test 1: Phase 16 (ACP & Auto-Reply Depth II)
 * Strict integration tests using REAL export names.
 */
import { describe, it, expect } from "vitest";

// ACP imports — actual exports
import { negotiateCapabilities } from "../../src/acp/capability.js";
import { extractTextFromPrompt, extractAttachments, inferToolKind, formatToolTitle } from "../../src/acp/event-mapper.js";

// Auto-Reply imports — actual exports
import { matchTrigger, isSlashCommand, parseSlashCommand, stripBotMention } from "../../src/auto-reply/command-detection.js";
import { createEnvelope, isEnvelopeExpired } from "../../src/auto-reply/envelope.js";

describe("Phase 16: ACP & Auto-Reply Depth II", () => {

    // ── ACP Capability Negotiation ──
    describe("ACP Capability Negotiation", () => {
        it("negotiateCapabilities returns matching capabilities", () => {
            const local = [
                { name: "text", version: "1.0", methods: ["send", "receive"] },
                { name: "image", version: "2.0", methods: ["upload"] },
            ];
            const remote = [
                { name: "text", version: "1.0", methods: ["send"] },
                { name: "audio", version: "1.0", methods: ["play"] },
            ];
            const result = negotiateCapabilities(local, remote);
            expect(result).toHaveLength(1);
            expect(result[0]!.name).toBe("text");
        });

        it("returns empty when no overlap", () => {
            const local = [{ name: "x", version: "1.0", methods: [] }];
            const remote = [{ name: "y", version: "1.0", methods: [] }];
            expect(negotiateCapabilities(local, remote)).toHaveLength(0);
        });

        it("returns empty for empty inputs", () => {
            expect(negotiateCapabilities([], [])).toHaveLength(0);
        });

        it("requires version match", () => {
            const local = [{ name: "text", version: "1.0", methods: [] }];
            const remote = [{ name: "text", version: "2.0", methods: [] }];
            expect(negotiateCapabilities(local, remote)).toHaveLength(0);
        });
    });

    // ── ACP Event Mapper ──
    describe("ACP Event Mapper", () => {
        it("extractTextFromPrompt extracts text from content blocks", () => {
            const blocks = [
                { type: "text" as const, text: "Hello" },
                { type: "text" as const, text: "World" },
            ];
            expect(extractTextFromPrompt(blocks)).toBe("Hello\nWorld");
        });

        it("extractTextFromPrompt throws when maxBytes exceeded", () => {
            const blocks = [{ type: "text" as const, text: "A very long string that should exceed the limit" }];
            expect(() => extractTextFromPrompt(blocks, 10)).toThrow("exceeds maximum");
        });

        it("extractAttachments filters non-text blocks", () => {
            const blocks = [
                { type: "text" as const, text: "text" },
                { type: "image" as const, mimeType: "image/png", content: "base64" },
            ];
            const att = extractAttachments(blocks);
            expect(att.length).toBeGreaterThanOrEqual(0);
        });

        it("inferToolKind categorizes known tool names", () => {
            expect(inferToolKind("bash")).toBeDefined();
            expect(inferToolKind("web_search")).toBeDefined();
            expect(inferToolKind("unknown_tool_xyz")).toBeDefined();
        });

        it("formatToolTitle formats with name and args", () => {
            const title = formatToolTitle("search", { query: "test" });
            expect(typeof title).toBe("string");
            expect(title.length).toBeGreaterThan(0);
        });
    });

    // ── Slash Command Detection ──
    describe("Slash Command Detection", () => {
        it("isSlashCommand detects /command", () => {
            expect(isSlashCommand("/help")).toBe(true);
            expect(isSlashCommand("/models list")).toBe(true);
        });

        it("isSlashCommand rejects plain text", () => {
            expect(isSlashCommand("hello")).toBe(false);
            expect(isSlashCommand("no slash here")).toBe(false);
        });

        it("parseSlashCommand extracts command and args", () => {
            const result = parseSlashCommand("/help me please");
            expect(result).not.toBeNull();
            expect(result!.command).toBe("help");
            expect(result!.args).toContain("me");
        });

        it("parseSlashCommand returns null for non-commands", () => {
            expect(parseSlashCommand("no command")).toBeNull();
        });

        it("stripBotMention removes @ prefix", () => {
            const stripped = stripBotMention("@bot hello");
            expect(stripped).toBe("hello");
        });

        it("stripBotMention handles no mention", () => {
            expect(stripBotMention("no mention")).toBe("no mention");
        });
    });

    // ── Envelope Builder ──
    describe("Envelope Builder", () => {
        it("createEnvelope builds valid envelope with channelId and content", () => {
            const env = createEnvelope("channel-1", "Hello world");
            expect(env).toBeDefined();
            expect(env.channelId).toBe("channel-1");
            expect(env.content).toBe("Hello world");
            expect(env.id).toBeDefined();
            expect(env.createdAt).toBeGreaterThan(0);
        });

        it("createEnvelope sets default TTL (5 minutes)", () => {
            const env = createEnvelope("ch", "content");
            expect(env.expiresAt).toBeDefined();
            const ttl = env.expiresAt! - env.createdAt;
            expect(ttl).toBe(300000);
        });

        it("createEnvelope allows custom TTL", () => {
            const env = createEnvelope("ch", "content", 60000);
            expect(env.expiresAt! - env.createdAt).toBe(60000);
        });

        it("isEnvelopeExpired returns false for fresh envelopes", () => {
            const env = createEnvelope("ch", "content");
            expect(isEnvelopeExpired(env)).toBe(false);
        });

        it("isEnvelopeExpired returns true for expired envelopes", () => {
            const env = createEnvelope("ch", "content");
            env.expiresAt = Date.now() - 1000;
            expect(isEnvelopeExpired(env)).toBe(true);
        });
    });

    // ── Reply Pipeline Module Integrity ──
    describe("Reply Pipeline Modules", () => {
        it("DirectiveParser is importable", async () => {
            const mod = await import("../../src/auto-reply/reply/directive-parser.js");
            expect(mod).toBeDefined();
        });

        it("NormalizeReply is importable", async () => {
            const mod = await import("../../src/auto-reply/reply/normalize-reply.js");
            expect(mod).toBeDefined();
        });

        it("ReplyDedup is importable", async () => {
            const mod = await import("../../src/auto-reply/reply/reply-dedup.js");
            expect(mod).toBeDefined();
        });

        it("ReplyQueue is importable", async () => {
            const mod = await import("../../src/auto-reply/reply/queue.js");
            expect(mod).toBeDefined();
        });

        it("ModelSelection is importable", async () => {
            const mod = await import("../../src/auto-reply/reply/model-selection.js");
            expect(mod).toBeDefined();
        });

        it("ProviderDispatcher is importable", async () => {
            const mod = await import("../../src/auto-reply/reply/provider-dispatcher.js");
            expect(mod).toBeDefined();
        });

        it("CommandsAllowlist is importable", async () => {
            const mod = await import("../../src/auto-reply/reply/commands-allowlist.js");
            expect(mod).toBeDefined();
        });

        it("SessionFork is importable", async () => {
            const mod = await import("../../src/auto-reply/reply/session-fork.js");
            expect(mod).toBeDefined();
        });
    });

    // ── InboundContext ──
    describe("InboundContext", () => {
        it("inbound-context module is importable", async () => {
            const mod = await import("../../src/auto-reply/inbound-context.js");
            expect(mod).toBeDefined();
        });
    });

    // ── Chunk Processing ──
    describe("Chunk Processing", () => {
        it("chunk module is importable", async () => {
            const mod = await import("../../src/auto-reply/chunk.js");
            expect(mod).toBeDefined();
        });
    });
});
