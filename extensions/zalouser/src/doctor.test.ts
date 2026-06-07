import { describe, expect, it } from "vitest";
import { normalizeCompatibilityConfig } from "./doctor-contract.js";

describe("zalouser doctor compatibility", () => {
  it("moves legacy group allow aliases to enabled", () => {
    const result = normalizeCompatibilityConfig({
      cfg: {
        channels: {
          zalouser: {
            groups: {
              family: { allow: true },
            },
          },
        },
      } as never,
    });

    expect(result.config).toEqual({
      channels: {
        zalouser: {
          groups: {
            family: { enabled: true },
          },
        },
      },
    });
    expect(result.changes[0]).toContain("channels.zalouser.groups.family.allow");
  });
});
