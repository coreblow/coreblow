import { describe, expect, it } from "vitest";
import {
  ADMIN_SCOPE,
  APPROVALS_SCOPE,
  PAIRING_SCOPE,
  READ_SCOPE,
  TALK_SECRETS_SCOPE,
  WRITE_SCOPE,
  isOperatorScope,
} from "./operator-scopes.js";
import * as methodScopes from "./method-scopes.js";

describe("operator scopes", () => {
  it("accepts each known operator scope", () => {
    for (const scope of [
      ADMIN_SCOPE,
      READ_SCOPE,
      WRITE_SCOPE,
      APPROVALS_SCOPE,
      PAIRING_SCOPE,
      TALK_SECRETS_SCOPE,
    ]) {
      expect(isOperatorScope(scope)).toBe(true);
    }
  });

  it("rejects unknown or non-string scope input", () => {
    expect(isOperatorScope("operator.unknown")).toBe(false);
    expect(isOperatorScope(" operator.read ")).toBe(false);
    expect(isOperatorScope(undefined)).toBe(false);
  });

  it("preserves the existing method-scopes export surface", () => {
    expect(methodScopes.ADMIN_SCOPE).toBe(ADMIN_SCOPE);
    expect(methodScopes.READ_SCOPE).toBe(READ_SCOPE);
    expect(methodScopes.WRITE_SCOPE).toBe(WRITE_SCOPE);
    expect(methodScopes.APPROVALS_SCOPE).toBe(APPROVALS_SCOPE);
    expect(methodScopes.PAIRING_SCOPE).toBe(PAIRING_SCOPE);
    expect(methodScopes.TALK_SECRETS_SCOPE).toBe(TALK_SECRETS_SCOPE);
  });
});
