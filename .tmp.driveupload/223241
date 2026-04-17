import { describe, expect, it } from "vitest";
import { buildPlatformRuntimeLogHints, buildPlatformServiceStartHints } from "./runtime-hints.js";

describe("buildPlatformRuntimeLogHints", () => {
  it("renders launchd log hints on darwin", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "darwin",
        env: {
          OPENCLAW_STATE_DIR: "/tmp/coreblow-state",
          OPENCLAW_LOG_PREFIX: "gateway",
        },
        systemdServiceName: "coreblow-gateway",
        windowsTaskName: "CoreBlow Gateway",
      }),
    ).toEqual([
      "Launchd stdout (if installed): /tmp/coreblow-state/logs/gateway.log",
      "Launchd stderr (if installed): /tmp/coreblow-state/logs/gateway.err.log",
    ]);
  });

  it("renders systemd and windows hints by platform", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "linux",
        systemdServiceName: "coreblow-gateway",
        windowsTaskName: "CoreBlow Gateway",
      }),
    ).toEqual(["Logs: journalctl --user -u coreblow-gateway.service -n 200 --no-pager"]);
    expect(
      buildPlatformRuntimeLogHints({
        platform: "win32",
        systemdServiceName: "coreblow-gateway",
        windowsTaskName: "CoreBlow Gateway",
      }),
    ).toEqual(['Logs: schtasks /Query /TN "CoreBlow Gateway" /V /FO LIST']);
  });
});

describe("buildPlatformServiceStartHints", () => {
  it("builds platform-specific service start hints", () => {
    expect(
      buildPlatformServiceStartHints({
        platform: "darwin",
        installCommand: "coreblow gateway install",
        startCommand: "coreblow gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.coreblow.gateway.plist",
        systemdServiceName: "coreblow-gateway",
        windowsTaskName: "CoreBlow Gateway",
      }),
    ).toEqual([
      "coreblow gateway install",
      "coreblow gateway",
      "launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.coreblow.gateway.plist",
    ]);
    expect(
      buildPlatformServiceStartHints({
        platform: "linux",
        installCommand: "coreblow gateway install",
        startCommand: "coreblow gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.coreblow.gateway.plist",
        systemdServiceName: "coreblow-gateway",
        windowsTaskName: "CoreBlow Gateway",
      }),
    ).toEqual([
      "coreblow gateway install",
      "coreblow gateway",
      "systemctl --user start coreblow-gateway.service",
    ]);
  });
});
