import { describe, it, expect } from "vitest";
import {
  resolveWebSearchEnabled,
  listWebSearchProviders,
  listConfiguredWebSearchProviders,
  resolveWebSearchProviderId,
  resolveWebSearchDefinition,
  runWebSearch,
} from "./runtime.js";

describe("runtime — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof resolveWebSearchEnabled).toBe("function");
    expect(typeof listWebSearchProviders).toBe("function");
    expect(typeof listConfiguredWebSearchProviders).toBe("function");
    expect(typeof resolveWebSearchProviderId).toBe("function");
    expect(typeof resolveWebSearchDefinition).toBe("function");
    expect(typeof runWebSearch).toBe("function");
  });
});
