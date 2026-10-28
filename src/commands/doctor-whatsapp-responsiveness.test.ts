import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";

const noteMock = vi.hoisted(() => vi.fn());
const spawnSyncMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", async () => {
  const { mockNodeChildProcessSpawnSync } = await import("../plugin-sdk/test-node-mocks.js");
  return mockNodeChildProcessSpawnSync(spawnSyncMock);
});

vi.mock("../terminal/note.js", () => ({
  note: noteMock,
}));

const { listLocalTuiProcesses, noteWhatsappResponsivenessHealth, terminateLocalTuiProcesses } =
  await import("./doctor-whatsapp-responsiveness.js");

describe("doctor WhatsApp responsiveness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists only verified local TUI processes", () => {
    spawnSyncMock.mockReturnValue({
      status: 0,
      stdout: [
        " 101 coreblow-tui",
        " 102 /usr/bin/node /usr/lib/node_modules/coreblow/dist/index.js gateway --port 18789",
        " 103 coreblow channels",
        " 104 coreblow tui --local",
      ].join("\n"),
    });

    expect(listLocalTuiProcesses()).toEqual([
      { pid: 101, command: "coreblow-tui" },
      { pid: 104, command: "coreblow tui --local" },
    ]);
  });

  it("terminates stale local TUI processes with a kill fallback", async () => {
    const alive = new Set([101]);
    const signals: Array<[number, string | number]> = [];
    const controller = {
      kill: vi.fn((pid: number, signal: string | number) => {
        signals.push([pid, signal]);
        if (signal === "SIGKILL") {
          alive.delete(pid);
          return true;
        }
        if (signal === 0) {
          if (alive.has(pid)) {
            return true;
          }
          throw new Error("gone");
        }
        return true;
      }),
    };

    await expect(
      terminateLocalTuiProcesses({
        processes: [{ pid: 101, command: "coreblow-tui" }],
        controller,
        graceMs: 0,
      }),
    ).resolves.toEqual({ stopped: [101], failed: [] });
    expect(signals).toEqual([
      [101, "SIGTERM"],
      [101, 0],
      [101, "SIGKILL"],
      [101, 0],
    ]);
  });

  it("warns and repairs local TUI pressure when WhatsApp is enabled and the gateway is degraded", async () => {
    const terminate = vi.fn().mockResolvedValue({ stopped: [101], failed: [] });
    const cfg = { channels: { whatsapp: { enabled: true } } } as CoreBlowConfig;

    await noteWhatsappResponsivenessHealth({
      cfg,
      status: {
        eventLoop: {
          degraded: true,
          reasons: ["event_loop_delay"],
          intervalMs: 30_000,
          delayP99Ms: 42,
          delayMaxMs: 12_000,
          utilization: 0.3,
          cpuCoreRatio: 0.4,
        },
      },
      shouldRepair: true,
      listLocalTuiProcesses: () => [{ pid: 101, command: "coreblow-tui" }],
      terminateLocalTuiProcesses: terminate,
    });

    expect(terminate).toHaveBeenCalledWith({
      processes: [{ pid: 101, command: "coreblow-tui" }],
    });
    expect(noteMock).toHaveBeenCalledWith(
      [
        "Gateway event loop is degraded while local TUI clients are running.",
        "WhatsApp replies can queue behind TUI startup/session refresh work.",
        "Local TUI pids: 101",
        "",
        "Stopped local TUI clients: 101",
      ].join("\n"),
      "WhatsApp responsiveness",
    );
  });

  it("does not treat generic model routing as a WhatsApp-only issue", async () => {
    const cfg = {
      channels: { whatsapp: { enabled: true } },
      agents: { defaults: { model: { primary: "openai-codex/gpt-5.5" } } },
    } as CoreBlowConfig;

    await noteWhatsappResponsivenessHealth({
      cfg,
      status: {
        eventLoop: {
          degraded: false,
          reasons: [],
          intervalMs: 1,
          delayP99Ms: 0,
          delayMaxMs: 0,
          utilization: 0,
          cpuCoreRatio: 0,
        },
      },
      shouldRepair: true,
      listLocalTuiProcesses: () => [],
    });

    expect(noteMock).not.toHaveBeenCalled();
  });
});
