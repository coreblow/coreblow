import { describe, expect, it } from "vitest";
import { normalizeAccountId } from "../routing/session-key.js";
import { listConfiguredAccountIds } from "./account-configured-ids.js";

describe("listConfiguredAccountIds", () => {
  it("normalizes, deduplicates, and skips empty account ids", () => {
    expect(
      listConfiguredAccountIds({
        accounts: {
          "": {},
          "Router D": {},
          "router-d": {},
          "Personal A": {},
        },
        normalizeAccountId,
      }),
    ).toEqual(["router-d", "personal-a"]);
  });

  it("returns no ids when accounts are not configured", () => {
    expect(
      listConfiguredAccountIds({
        accounts: undefined,
        normalizeAccountId,
      }),
    ).toEqual([]);
  });
});
