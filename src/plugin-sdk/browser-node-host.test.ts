import { describe, expect, it } from "vitest";
import { runBrowserProxyCommand } from "./browser-node-host.js";

describe("browser node-host facade", () => {
  it("preserves proxy request validation", async () => {
    await expect(runBrowserProxyCommand("{}")).rejects.toThrow("INVALID_REQUEST: path required");
  });
});
