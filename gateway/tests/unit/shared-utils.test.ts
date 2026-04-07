import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { isTruthy, resolveConfigPath, hasBinary, clearHasBinaryCache, evaluateRuntimeRequires } from "../../src/shared/config-eval.js";
import { normalizeStringList, parseFrontmatterBool, resolveManifestRequires } from "../../src/shared/frontmatter.js";
import { chunkTextByBreakResolver } from "../../src/shared/text-chunking.js";
import { UsageTracker } from "../../src/shared/usage-tracker.js";
import { isPidAlive } from "../../src/shared/pid-alive.js";
import { getOrCreateGlobalSingleton } from "../../src/shared/global-singleton.js";

describe("Shared Utils Phase 26", () => {
    describe("config-eval.ts", () => {
        test("isTruthy evaluates correctly", () => {
            expect(isTruthy(true)).toBe(true);
            expect(isTruthy(false)).toBe(false);
            expect(isTruthy(1)).toBe(true);
            expect(isTruthy(0)).toBe(false);
            expect(isTruthy("yes")).toBe(true);
            expect(isTruthy("  ")).toBe(false);
            expect(isTruthy(null)).toBe(false);
            expect(isTruthy(undefined)).toBe(false);
        });

        test("resolveConfigPath resolves dot notation", () => {
            const config = { a: { b: { c: 42 } } };
            expect(resolveConfigPath(config, "a.b.c")).toBe(42);
            expect(resolveConfigPath(config, "a.b.x")).toBeUndefined();
            expect(resolveConfigPath(config, "x.y.z")).toBeUndefined();
        });

        test("evaluateRuntimeRequires checks bins and config", () => {
            const params = {
                requires: { bins: ["node"], config: ["feature.enabled"] },
                hasBin: (bin: string) => bin === "node",
                hasEnv: () => true,
                isConfigPathTruthy: (path: string) => path === "feature.enabled",
            };
            expect(evaluateRuntimeRequires(params)).toBe(true);

            expect(
                evaluateRuntimeRequires({ ...params, hasBin: (bin) => bin !== "node" })
            ).toBe(false);
        });
    });

    describe("frontmatter.ts", () => {
        test("normalizeStringList handles array and comma separated strings", () => {
            expect(normalizeStringList(["a", " b ", "c"])).toEqual(["a", "b", "c"]);
            expect(normalizeStringList("a, b ,c ")).toEqual(["a", "b", "c"]);
            expect(normalizeStringList(null)).toEqual([]);
        });

        test("parseFrontmatterBool parses strings correctly", () => {
            expect(parseFrontmatterBool("true", false)).toBe(true);
            expect(parseFrontmatterBool("yes", false)).toBe(true);
            expect(parseFrontmatterBool("1", false)).toBe(true);
            expect(parseFrontmatterBool("false", true)).toBe(false);
            expect(parseFrontmatterBool(undefined, true)).toBe(true);
        });

        test("resolveManifestRequires maps metadata object", () => {
            const metadata = { requires: { bins: "node, npm", env: ["PATH"] } };
            const req = resolveManifestRequires(metadata);
            expect(req).toEqual({
                bins: ["node", "npm"],
                anyBins: [],
                env: ["PATH"],
                config: [],
            });
        });
    });

    describe("text-chunking.ts", () => {
        test("chunkTextByBreakResolver splits accurately", () => {
            const text = "Hello world. This is a test. Another sentence.";
            const resolveBreak = (window: string) => {
                const idx = window.lastIndexOf(". ");
                return idx > 0 ? idx + 2 : window.length;
            };

            const chunks = chunkTextByBreakResolver(text, 25, resolveBreak);
            expect(chunks).toEqual([
                "Hello world.",
                "This is a test.",
                "Another sentence."
            ]);
        });
    });

    describe("usage-tracker.ts", () => {
        test("UsageTracker aggregates costs and tokens", () => {
            const tracker = new UsageTracker();
            tracker.recordUsage({ model: "gpt-4", inputTokens: 10, outputTokens: 20, cost: 0.05, timestamp: 1 });
            tracker.recordUsage({ model: "gpt-4", inputTokens: 5, outputTokens: 5, cost: 0.02, timestamp: 2 });
            tracker.recordUsage({ model: "claude", inputTokens: 100, outputTokens: 10, cost: 0.1, timestamp: 3 });

            const summary = tracker.getUsageSummary();
            expect(summary).toEqual({ totalTokens: 150, totalCost: 0.17, recordCount: 3 });

            const byModel = tracker.getUsageByModel();
            expect(byModel.get("gpt-4")).toEqual({ tokens: 40, cost: 0.07 });
            expect(byModel.get("claude")).toEqual({ tokens: 110, cost: 0.1 });
        });
    });

    describe("pid-alive.ts", () => {
        test("isPidAlive works for current process", () => {
            expect(isPidAlive(process.pid)).toBe(true);
            // highly unlikely to be alive PID
            expect(isPidAlive(999999)).toBe(false);
        });
    });

    describe("global-singleton.ts", () => {
        test("getOrCreateGlobalSingleton creates and retrieves", () => {
            let calls = 0;
            const factory = () => { calls++; return { value: 42 }; };
            
            const a = getOrCreateGlobalSingleton("test-singleton", factory);
            const b = getOrCreateGlobalSingleton("test-singleton", factory);
            
            expect(a).toBe(b);
            expect(a.value).toBe(42);
            expect(calls).toBe(1);
        });
    });
});
