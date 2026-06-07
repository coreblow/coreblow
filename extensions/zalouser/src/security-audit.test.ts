import { describe, expect, it } from "vitest";
import {
  collectZalouserSecurityAuditFindings,
  isZalouserMutableGroupEntry,
} from "./security-audit.js";

describe("zalouser security audit", () => {
  it("detects mutable group entries", () => {
    expect(isZalouserMutableGroupEntry("Family Group")).toBe(true);
    expect(isZalouserMutableGroupEntry("group:12345")).toBe(false);
    expect(isZalouserMutableGroupEntry("g-stable")).toBe(false);
  });

  it("reports mutable group entries in account config", () => {
    const findings = collectZalouserSecurityAuditFindings({
      accountId: "main",
      account: {
        accountId: "main",
        enabled: true,
        profile: "main",
        authenticated: true,
        config: {
          groups: {
            "Family Group": {},
          },
        },
      } as never,
      orderedAccountIds: ["main"],
      hasExplicitAccountPath: true,
    });

    expect(findings[0]?.checkId).toBe("channels.zalouser.groups.mutable_entries");
    expect(findings[0]?.severity).toBe("warn");
  });
});
