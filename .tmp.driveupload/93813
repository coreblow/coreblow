import { describe, it, expect } from "vitest";
import { httpEndpoints } from "../../src/gateway/server-http.js";
import { parseGatewayRole } from "../../src/gateway/role-policy.js";
import { authenticateDevice } from "../../src/gateway/device-auth.js";
import { isInputAllowed } from "../../src/gateway/input-allowlist.js";
import { isPathSafe } from "../../src/gateway/security-path.js";

describe("Phase 10: Final Gateway Infrastructure Hardening", () => {
    it("should export HTTP endpoints", () => {
        expect(httpEndpoints).toBeDefined();
        // Check core mapped endpoints
        expect(httpEndpoints.some(e => e.pathPrefix === "/v1/models")).toBeTruthy();
    });

    it("should validate Gateway roles", () => {
        expect(parseGatewayRole("operator")).toBe("operator");
        expect(parseGatewayRole("node")).toBe("node");
        expect(parseGatewayRole("admin")).toBeNull();
    });

    it("should authenticate devices securely", () => {
        const check1 = authenticateDevice(["valid-token-123"], "valid-token-123");
        expect(check1.allowed).toBe(true);

        const check2 = authenticateDevice(["valid-token-123"], "wrong-token");
        expect(check2.allowed).toBe(false);
    });

    it("should enforce strict input formatting", () => {
        expect(isInputAllowed("Hello World")).toBe(true);
        // ASCII zero-byte null injection
        expect(isInputAllowed("Hello\0World")).toBe(false);
    });

    it("should prevent basic path traversal via security-path", () => {
        const isSafe1 = isPathSafe("/safe/base", "/safe/base/nested");
        expect(isSafe1).toBe(true);
        const isSafe2 = isPathSafe("/safe/base", "../unsafe");
        expect(isSafe2).toBe(false);
    });
});
