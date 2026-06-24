import { describe, expect, it } from "vitest";
import { closeTrackedBrowserTabsForSessions, movePathToTrash } from "./browser-maintenance.js";

describe("browser maintenance", () => {
  it("skips browser cleanup when no session keys are provided", async () => {
    await expect(closeTrackedBrowserTabsForSessions({ sessionKeys: [] })).resolves.toBe(0);
  });

  it("refuses filesystem roots and paths outside explicit roots", async () => {
    await expect(movePathToTrash("/")).rejects.toThrow("Refusing to trash root path");
    await expect(
      movePathToTrash("/tmp/outside", { allowedRoots: ["/tmp/inside"] }),
    ).rejects.toThrow("Refusing to trash path outside allowed roots");
  });
});
