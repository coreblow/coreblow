import { describe, expect, it } from "vitest";
import { listSearchProviderOptions, resolveSearchProviderOptions } from "./search-setup.js";

describe("search setup", () => {
  it("lists the same provider options as the resolver", () => {
    expect(listSearchProviderOptions({}).map((entry) => entry.id)).toEqual(
      resolveSearchProviderOptions({}).map((entry) => entry.id),
    );
  });
});
