import { beforeEach, describe, expect, it } from "vitest";
import {
  TrustZoneEnforcer,
  TrustZoneLevel,
  TrustZoneViolationError,
} from "./trust-zones.js";

describe("TrustZoneEnforcer", () => {
  let enforcer: TrustZoneEnforcer;

  beforeEach(async () => {
    enforcer = new TrustZoneEnforcer({
      secretKey: "test-secret-key-32-bytes-secure-hex",
      defaultTtlMs: 60_000,
    });
    await enforcer.start();
  });

  it("satisfies GatewayService lifecycle and health", async () => {
    expect(enforcer.health().status).toBe("healthy");
    await enforcer.stop();
    expect(enforcer.health().status).toBe("down");
  });

  it("generates and cryptographically verifies HMAC-SHA256 context tokens", () => {
    const token = enforcer.generateContextToken(
      TrustZoneLevel.AUTHENTICATED_WORKSPACE,
      "ctx-session-123",
      { userId: "usr-456" },
    );

    const payload = enforcer.verifyContextToken(token);
    expect(payload.zone).toBe(TrustZoneLevel.AUTHENTICATED_WORKSPACE);
    expect(payload.contextId).toBe("ctx-session-123");
    expect(payload.metadata?.userId).toBe("usr-456");
  });

  it("rejects tampered tokens or invalid signatures", () => {
    const token = enforcer.generateContextToken(
      TrustZoneLevel.PUBLIC_INGRESS,
      "ctx-public-1",
    );
    const [payloadPart] = token.split(".");
    const forgedToken = `${payloadPart}.tampered_signature_invalid`;

    expect(() => enforcer.verifyContextToken(forgedToken)).toThrow(
      /signature mismatch/,
    );
  });

  it("rejects expired context tokens", () => {
    const token = enforcer.generateContextToken(
      TrustZoneLevel.OPERATOR_HOST,
      "ctx-expired",
      undefined,
      -1000, // already expired
    );

    expect(() => enforcer.verifyContextToken(token)).toThrow(/expired/);
  });

  it("blocks lower zones from reading higher zone memory (OWASP ASI01)", () => {
    // Zone 0 attempting to read Zone 1 or Zone 2 memory
    expect(() =>
      enforcer.authorizeMemoryRead(
        TrustZoneLevel.PUBLIC_INGRESS,
        TrustZoneLevel.AUTHENTICATED_WORKSPACE,
        "team_private_notes",
      ),
    ).toThrow(TrustZoneViolationError);

    expect(() =>
      enforcer.authorizeMemoryRead(
        TrustZoneLevel.AUTHENTICATED_WORKSPACE,
        TrustZoneLevel.OPERATOR_HOST,
        "master_keychain",
      ),
    ).toThrow(TrustZoneViolationError);

    // Higher or equal zone reading lower zone is permitted
    expect(() =>
      enforcer.authorizeMemoryRead(
        TrustZoneLevel.OPERATOR_HOST,
        TrustZoneLevel.PUBLIC_INGRESS,
        "public_announcements",
      ),
    ).not.toThrow();

    expect(() =>
      enforcer.authorizeMemoryRead(
        TrustZoneLevel.AUTHENTICATED_WORKSPACE,
        TrustZoneLevel.AUTHENTICATED_WORKSPACE,
        "workspace_docs",
      ),
    ).not.toThrow();
  });

  it("enforces tool execution privilege boundaries according to zone hierarchy", () => {
    // Zone 0 cannot run host commands
    expect(() =>
      enforcer.authorizeToolExecution(TrustZoneLevel.PUBLIC_INGRESS, "bash"),
    ).toThrow(TrustZoneViolationError);

    expect(() =>
      enforcer.authorizeToolExecution(TrustZoneLevel.PUBLIC_INGRESS, "read_file"),
    ).toThrow(TrustZoneViolationError);

    // Zone 0 can run public tools
    expect(() =>
      enforcer.authorizeToolExecution(TrustZoneLevel.PUBLIC_INGRESS, "send_message"),
    ).not.toThrow();

    // Zone 1 can read/write files but cannot run host shell
    expect(() =>
      enforcer.authorizeToolExecution(TrustZoneLevel.AUTHENTICATED_WORKSPACE, "read_file"),
    ).not.toThrow();

    expect(() =>
      enforcer.authorizeToolExecution(TrustZoneLevel.AUTHENTICATED_WORKSPACE, "bash"),
    ).toThrow(TrustZoneViolationError);

    // Zone 2 (Operator Host) can run host shell
    expect(() =>
      enforcer.authorizeToolExecution(TrustZoneLevel.OPERATOR_HOST, "bash"),
    ).not.toThrow();
  });
});
