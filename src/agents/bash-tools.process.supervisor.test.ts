import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { supervisorMock } = vi.hoisted(() => ({
  supervisorMock: {
    spawn: vi.fn(),
    cancel: vi.fn(),
    cancelScope: vi.fn(),
    reconcileOrphans: vi.fn(),
    getRecord: vi.fn(),
  },
}));

const { killProcessTreeMock } = vi.hoisted(() => ({
  killProcessTreeMock: vi.fn(),
}));

vi.mock("../process/supervisor/index.js", () => ({
  getProcessSupervisor: () => supervisorMock,
}));

vi.mock("../process/kill-tree.js", () => ({
  killProcessTree: (...args: unknown[]) => killProcessTreeMock(...args),
}));

let addSession: typeof import("./bash-process-registry.js").addSession;
let resetProcessRegistryForTests: typeof import("./bash-process-registry.js").resetProcessRegistryForTests;
let createProcessSessionFixture: typeof import("./bash-process-registry.test-helpers.js").createProcessSessionFixture;
let createProcessTool: typeof import("./bash-tools.process.js").createProcessTool;

async function loadFreshProcessToolModulesForTest() {
  vi.resetModules();
  ({ addSession, resetProcessRegistryForTests } =
    await import("./bash-process-registry.js"));
  ({ createProcessSessionFixture } = await import("./bash-process-registry.test-helpers.js"));
  ({ createProcessTool } = await import("./bash-tools.process.js"));
}

function createBackgroundSession(id: string, pid?: number) {
  return createProcessSessionFixture({
    id,
    command: "sleep 999",
    backgrounded: true,
    ...(pid === undefined ? {} : { pid }),
  });
}

describe("process tool supervisor cancellation", () => {
  beforeEach(async () => {
    await loadFreshProcessToolModulesForTest();
    supervisorMock.spawn.mockClear();
    supervisorMock.cancel.mockClear();
    supervisorMock.cancelScope.mockClear();
    supervisorMock.reconcileOrphans.mockClear();
    supervisorMock.getRecord.mockClear();
    killProcessTreeMock.mockClear();
  });

  afterEach(() => {
    resetProcessRegistryForTests();
  });

  it("cancels session via supervisor when kill action is used", async () => {
    const session = createBackgroundSession("kill-test-1", 12345);
    addSession(session);

    supervisorMock.getRecord.mockReturnValue({ pid: 12345 });

    const processTool = createProcessTool();
    await processTool.execute("kill-1", {
      action: "kill",
      sessionId: "kill-test-1",
    });

    expect(
      supervisorMock.cancel.mock.calls.length + killProcessTreeMock.mock.calls.length,
    ).toBeGreaterThan(0);
  });

  it("returns text response for kill on unknown session", async () => {
    const processTool = createProcessTool();
    const result = await processTool.execute("kill-unknown", {
      action: "kill",
      sessionId: "nonexistent",
    });

    // CB returns a text content — check it's returned without throwing
    expect(result.content).toBeDefined();
    const text = result.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("");
    // The response should mention the session somehow
    expect(text.toLowerCase()).toMatch(/session|active|nonexistent/i);
  });
});
