import { describe, expect, it } from "vitest";
import { GoogleChatChannelConfigSchema } from "./config-schema.js";

describe("googlechat config schema", () => {
  it("is importable", () => {
    expect(GoogleChatChannelConfigSchema).toBeDefined();
  });
});
