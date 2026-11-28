import { describe, expect, it } from "vitest";
import {
  assertExecuteCodeSandboxEligible,
  isRpcToolAllowedForExecuteCode,
} from "../agents/code-execution/index.js";

describe("execute_code sandbox & RPC allowlist security gate", () => {
  it("enforces fail-closed sandbox gating and rejects dangerous orchestration tools", () => {
    expect(() => assertExecuteCodeSandboxEligible({ sandboxEnabled: false })).toThrow("fail-closed");
    expect(isRpcToolAllowedForExecuteCode("gateway")).toBe(false);
    expect(isRpcToolAllowedForExecuteCode("nodes")).toBe(false);
    expect(isRpcToolAllowedForExecuteCode("sessions_spawn")).toBe(false);
    expect(isRpcToolAllowedForExecuteCode("execute_code")).toBe(false);
    expect(isRpcToolAllowedForExecuteCode("read")).toBe(true);
  });
});
