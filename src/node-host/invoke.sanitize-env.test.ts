import { describe, it, expect } from "vitest";

import { sanitizeEnv, parseWindowsCodePage, decodeCapturedOutputBuffer, handleInvoke, coerceNodeInvokePayload, buildNodeInvokeResultParams } from "./invoke.js";

describe("node-host sanitizeEnv", () => {
  it("resolves all imports without errors", () => {
    expect(sanitizeEnv).toBeDefined();
    expect(parseWindowsCodePage).toBeDefined();
    expect(decodeCapturedOutputBuffer).toBeDefined();
    expect(handleInvoke).toBeDefined();
    expect(coerceNodeInvokePayload).toBeDefined();
    expect(buildNodeInvokeResultParams).toBeDefined();
  });

  it.todo("ignores PATH overrides");
  it.todo("blocks dangerous env keys/prefixes");
  it.todo("blocks dangerous override-only env keys");
  it.todo("drops dangerous inherited env keys even without overrides");
  it.todo("preserves inherited non-portable Windows-style env keys");
  it.todo("parses code pages from chcp output text");
  it.todo("decodes GBK output on Windows when code page is known");
  it.todo("omits optional fields when null/undefined");
  it.todo("includes payloadJSON when provided");
  it.todo("includes payload when provided");
});
