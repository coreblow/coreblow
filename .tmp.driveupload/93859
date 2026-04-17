/**
 * Phase 25 — Test 10: Gateway Security Pipeline
 * Tests ALL security modules from Gateway Phases 1-10.
 */
import { describe, it, expect } from "vitest";
import { parseGatewayRole, isRoleAuthorizedForMethod, roleCanSkipDeviceIdentity } from "../../src/gateway/role-policy.js";
import { checkOrigin } from "../../src/gateway/origin-check.js";
import { authenticateDevice, generateDeviceToken } from "../../src/gateway/device-auth.js";
import { resolveHandshakeTimeout, HANDSHAKE_TIMEOUT_MS } from "../../src/gateway/handshake-timeouts.js";
import { isPathSafe, sanitizePath } from "../../src/gateway/security-path.js";
import { isInputAllowed } from "../../src/gateway/input-allowlist.js";
import { validateStartupAuth } from "../../src/gateway/startup-auth.js";
import { planCredentialResolution } from "../../src/gateway/credential-planner.js";
import { resolveGatewayConnectionAuthFromConfig } from "../../src/gateway/connection-auth.js";

describe("GW Security Pipeline — Full Integration", () => {

    // ── Role Policy ──
    describe("Role Policy", () => {
        it("parseGatewayRole accepts 'operator'", () => expect(parseGatewayRole("operator")).toBe("operator"));
        it("parseGatewayRole accepts 'node'", () => expect(parseGatewayRole("node")).toBe("node"));
        it("parseGatewayRole rejects unknown", () => expect(parseGatewayRole("admin")).toBeNull());
        it("parseGatewayRole rejects numbers", () => expect(parseGatewayRole(42)).toBeNull());
        it("parseGatewayRole rejects null", () => expect(parseGatewayRole(null)).toBeNull());

        it("roleCanSkipDeviceIdentity allows operator with sharedAuth", () => {
            expect(roleCanSkipDeviceIdentity("operator", true)).toBe(true);
        });
        it("roleCanSkipDeviceIdentity denies node", () => {
            expect(roleCanSkipDeviceIdentity("node", true)).toBe(false);
        });
    });

    // ── Origin Check ──
    describe("Origin Check", () => {
        it("allows missing origin", () => expect(checkOrigin(undefined, [])).toBe(true));
        it("allows wildcard origin", () => expect(checkOrigin("http://evil.com", ["*"])).toBe(true));
        it("allows matching origin", () => expect(checkOrigin("http://localhost:3000", ["http://localhost:3000"])).toBe(true));
        it("blocks non-matching origin", () => expect(checkOrigin("http://evil.com", ["http://localhost:3000"])).toBe(false));
        it("allows with empty allowlist", () => expect(checkOrigin("http://any.com", [])).toBe(true));
    });

    // ── Device Auth ──
    describe("Device Auth", () => {
        it("authenticates valid token", () => {
            expect(authenticateDevice(["tok-123"], "tok-123").allowed).toBe(true);
        });
        it("rejects invalid token", () => {
            expect(authenticateDevice(["tok-123"], "wrong").allowed).toBe(false);
        });
        it("rejects missing token", () => {
            expect(authenticateDevice(["tok-123"], undefined).allowed).toBe(false);
        });
        it("rejects empty registry", () => {
            expect(authenticateDevice([], "tok-123").allowed).toBe(false);
        });
        it("generateDeviceToken produces prefixed token", () => {
            const tok = generateDeviceToken();
            expect(tok.startsWith("dev_")).toBe(true);
            expect(tok.length).toBeGreaterThan(10);
        });
    });

    // ── Handshake Timeouts ──
    describe("Handshake Timeouts", () => {
        it("default timeout is 10 seconds", () => expect(HANDSHAKE_TIMEOUT_MS).toBe(10000));
        it("resolves custom timeout", () => expect(resolveHandshakeTimeout(5000)).toBe(5000));
        it("falls back for invalid timeout", () => expect(resolveHandshakeTimeout(-1)).toBe(10000));
        it("falls back for NaN", () => expect(resolveHandshakeTimeout(NaN)).toBe(10000));
    });

    // ── Security Path ──
    describe("Security Path", () => {
        it("allows safe paths", () => expect(isPathSafe("/base", "sub/file.txt")).toBe(true));
        it("blocks traversal", () => expect(isPathSafe("/base", "../etc/passwd")).toBe(false));
        it("blocks null bytes", () => expect(isPathSafe("/base", "file\0.txt")).toBe(false));
        it("blocks empty path", () => expect(isPathSafe("/base", "")).toBe(false));
        it("sanitizePath removes null bytes", () => {
            expect(sanitizePath("a\0b")).toBe("ab");
        });
        it("sanitizePath removes special chars", () => {
            expect(sanitizePath("file<name>")).toBe("filename");
        });
    });

    // ── Input Allowlist ──
    describe("Input Allowlist", () => {
        it("allows normal strings", () => expect(isInputAllowed("Hello")).toBe(true));
        it("blocks null bytes", () => expect(isInputAllowed("a\0b")).toBe(false));
        it("blocks control chars", () => expect(isInputAllowed("a\x01b")).toBe(false));
        it("allows numbers", () => expect(isInputAllowed(42)).toBe(true));
        it("allows booleans", () => expect(isInputAllowed(true)).toBe(true));
        it("recursively validates objects", () => {
            expect(isInputAllowed({ key: "value" })).toBe(true);
            expect(isInputAllowed({ key: "a\0b" })).toBe(false);
        });
        it("recursively validates arrays", () => {
            expect(isInputAllowed(["ok", "fine"])).toBe(true);
            expect(isInputAllowed(["ok", "a\x02b"])).toBe(false);
        });
    });

    // ── Startup Auth ──
    describe("Startup Auth", () => {
        const log = { info: () => {}, warn: () => {}, error: () => {} };

        it("allows explicit none mode", () => {
            expect(validateStartupAuth({ gateway: { auth: { mode: "none" } } }, log)).toBe(true);
        });
        it("fails token mode without token (default)", () => {
            // Empty config defaults to mode 'token' via planner, but no token provided
            expect(validateStartupAuth({}, log)).toBe(false);
        });
        it("passes token mode with token", () => {
            expect(validateStartupAuth({ gateway: { auth: { mode: "token", token: "abc" } } }, log)).toBe(true);
        });
    });

    // ── Credential Planner ──
    describe("Credential Planner", () => {
        it("defaults to token mode", () => {
            const plan = planCredentialResolution({});
            expect(plan.mode).toBe("token");
        });
        it("respects explicit none mode", () => {
            const plan = planCredentialResolution({ gateway: { auth: { mode: "none" } } });
            expect(plan.mode).toBe("none");
        });
    });

    // ── Connection Auth ──
    describe("Connection Auth", () => {
        it("resolves token from config", () => {
            const result = resolveGatewayConnectionAuthFromConfig({
                config: { gateway: { auth: { mode: "token", token: "my-token" } } },
            });
            expect(result.token).toBe("my-token");
        });

        it("returns empty object for none mode", () => {
            const result = resolveGatewayConnectionAuthFromConfig({
                config: { gateway: { auth: { mode: "none" } } },
            });
            expect(result.token).toBeUndefined();
        });
    });
});
