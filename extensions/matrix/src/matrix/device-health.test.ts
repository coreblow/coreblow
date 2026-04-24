import { describe, expect, it } from "vitest";
import { isCoreBlowManagedMatrixDevice, summarizeMatrixDeviceHealth } from "./device-health.js";

describe("matrix device health", () => {
  it("detects CoreBlow-managed device names", () => {
    expect(isCoreBlowManagedMatrixDevice("CoreBlow Gateway")).toBe(true);
    expect(isCoreBlowManagedMatrixDevice("CoreBlow Debug")).toBe(true);
    expect(isCoreBlowManagedMatrixDevice("Element iPhone")).toBe(false);
    expect(isCoreBlowManagedMatrixDevice(null)).toBe(false);
  });

  it("summarizes stale CoreBlow-managed devices separately from the current device", () => {
    const summary = summarizeMatrixDeviceHealth([
      {
        deviceId: "du314Zpw3A",
        displayName: "CoreBlow Gateway",
        current: true,
      },
      {
        deviceId: "BritdXC6iL",
        displayName: "CoreBlow Gateway",
        current: false,
      },
      {
        deviceId: "G6NJU9cTgs",
        displayName: "CoreBlow Debug",
        current: false,
      },
      {
        deviceId: "phone123",
        displayName: "Element iPhone",
        current: false,
      },
    ]);

    expect(summary.currentDeviceId).toBe("du314Zpw3A");
    expect(summary.currentCoreBlowDevices).toEqual([
      expect.objectContaining({ deviceId: "du314Zpw3A" }),
    ]);
    expect(summary.staleCoreBlowDevices).toEqual([
      expect.objectContaining({ deviceId: "BritdXC6iL" }),
      expect.objectContaining({ deviceId: "G6NJU9cTgs" }),
    ]);
  });
});
