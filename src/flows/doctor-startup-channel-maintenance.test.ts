import { describe, expect, it, vi } from "vitest";
import { maybeRunDoctorStartupChannelMaintenance } from "./doctor-startup-channel-maintenance.js";

describe("doctor startup channel maintenance", () => {
  it("runs startup maintenance only while doctor fix is active", async () => {
    const runner = vi.fn(async () => {});
    await maybeRunDoctorStartupChannelMaintenance({
      cfg: {},
      runtime: console,
      shouldRepair: false,
      runChannelPluginStartupMaintenance: runner,
    });
    expect(runner).not.toHaveBeenCalled();

    await maybeRunDoctorStartupChannelMaintenance({
      cfg: {},
      runtime: console,
      shouldRepair: true,
      runChannelPluginStartupMaintenance: runner,
    });
    expect(runner).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: "doctor-fix", logPrefix: "doctor" }),
    );
  });
});
