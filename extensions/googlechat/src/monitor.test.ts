import { describe, expect, it } from "vitest";
import { warnAppPrincipalMisconfiguration } from "./monitor-webhook.js";

describe("googlechat monitor", () => {
  it("warns for app-url audiences without numeric appPrincipal", () => {
    const warnings: string[] = [];
    warnAppPrincipalMisconfiguration({
      audienceType: "app-url",
      appPrincipal: "bot@example.com",
      warn: (message) => warnings.push(message),
    });
    expect(warnings).toHaveLength(1);
  });
});
