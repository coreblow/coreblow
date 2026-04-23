import { describe, it, expect } from "vitest";
import {
  findCatalogTemplate,
  buildSingleProviderApiKeyCatalog,
  buildPairedProviderApiKeyCatalog,
} from "./provider-catalog.js";

describe("provider-catalog — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof findCatalogTemplate).toBe("function");
    expect(typeof buildSingleProviderApiKeyCatalog).toBe("function");
    expect(typeof buildPairedProviderApiKeyCatalog).toBe("function");
  });
});
