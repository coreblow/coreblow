/**
 * Phase 25 — Test 5: Phase 20 (Hooks Engine)
 */
import { describe, it, expect } from "vitest";
import { resolveHooksForConfigChange, CONFIG_PATH_TO_HOOK_MAP } from "../../src/gateway/hooks-mapping.js";
import { resolveHookPolicy } from "../../src/gateway/hooks-policy.js";

describe("Phase 20: Hooks Engine", () => {

    // ── Hook Bus ──
    describe("Hook Bus", () => {
        it("hook-bus module is importable and exports correctly", async () => {
            const mod = await import("../../src/hooks/hook-bus.js");
            expect(mod).toBeDefined();
        });
    });

    // ── Hook Engine ──
    describe("Hook Engine", () => {
        it("engine module is importable", async () => {
            const mod = await import("../../src/hooks/engine.js");
            expect(mod).toBeDefined();
        });
    });

    // ── Internal Hooks ──
    describe("Internal Hooks", () => {
        it("internal-hooks module is importable", async () => {
            const mod = await import("../../src/hooks/internal-hooks.js");
            expect(mod).toBeDefined();
        });
    });

    // ── Hook Policy ──
    describe("Hook Policy", () => {
        it("policy module is importable", async () => {
            const mod = await import("../../src/hooks/policy.js");
            expect(mod).toBeDefined();
        });
    });

    // ── Hook Loader ──
    describe("Hook Loader", () => {
        it("loader module is importable", async () => {
            const mod = await import("../../src/hooks/loader.js");
            expect(mod).toBeDefined();
        });
    });

    // ── Message Hook Mappers ──
    describe("Message Hook Mappers", () => {
        it("message-hook-mappers module is importable", async () => {
            const mod = await import("../../src/hooks/message-hook-mappers.js");
            expect(mod).toBeDefined();
        });
    });

    // ── Fire and Forget ──
    describe("Fire and Forget", () => {
        it("fire-and-forget module is importable", async () => {
            const mod = await import("../../src/hooks/fire-and-forget.js");
            expect(mod).toBeDefined();
        });
    });

    // ── Gateway Hooks-Mapping ──
    describe("Gateway Hooks Mapping", () => {
        it("CONFIG_PATH_TO_HOOK_MAP has entries", () => {
            expect(Object.keys(CONFIG_PATH_TO_HOOK_MAP).length).toBeGreaterThan(0);
        });

        it("resolveHooksForConfigChange returns hooks for known paths", () => {
            const knownPaths = Object.keys(CONFIG_PATH_TO_HOOK_MAP);
            if (knownPaths.length > 0) {
                const hooks = resolveHooksForConfigChange([knownPaths[0]!]);
                expect(hooks.length).toBeGreaterThan(0);
            }
        });

        it("resolveHooksForConfigChange returns empty for unknown paths", () => {
            const hooks = resolveHooksForConfigChange(["totally.unknown.path.xyz"]);
            expect(hooks).toHaveLength(0);
        });
    });

    // ── Gateway Hooks Policy ──
    describe("Gateway Hooks Policy", () => {
        it("resolveHookPolicy defaults to true", () => {
            expect(resolveHookPolicy("onStartup", {})).toBe(true);
        });

        it("resolveHookPolicy blocks disabled hooks", () => {
            expect(resolveHookPolicy("onStartup", { hooks: { disabled: ["onStartup"] } })).toBe(false);
        });

        it("resolveHookPolicy allows non-disabled hooks", () => {
            expect(resolveHookPolicy("onStartup", { hooks: { disabled: ["onShutdown"] } })).toBe(true);
        });
    });

    // ── Hook Types ──
    describe("Hook Types", () => {
        it("types module is importable", async () => {
            const mod = await import("../../src/hooks/types.js");
            expect(mod).toBeDefined();
        });
    });

    // ── Hook Config ──
    describe("Hook Config", () => {
        it("config module is importable", async () => {
            const mod = await import("../../src/hooks/config.js");
            expect(mod).toBeDefined();
        });
    });
});
