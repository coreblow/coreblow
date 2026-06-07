import { describe, expect, it } from "vitest";
import { configureClient } from "./tlon-api.js";

describe("tlon api", () => {
  it("accepts client configuration", () => {
    expect(() =>
      configureClient({
        shipUrl: "https://groups.tlon.network",
        shipName: "~zod",
        verbose: false,
        getCode: async () => "123456",
      }),
    ).not.toThrow();
  });
});
