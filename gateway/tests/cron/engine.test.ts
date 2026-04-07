import { describe, it, expect, vi, beforeEach } from "vitest";
import { cronService } from "../../src/cron/engine.js";
import * as store from "../../src/cron/store.js";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

vi.mock("../../src/cron/store.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/cron/store.js")>();
  return {
    ...actual,
    loadCronStore: vi.fn(),
    saveCronStore: vi.fn()
  };
});

describe("cron engine", () => {
  const mockWorkspace = path.join(os.homedir(), "mock-workspace");

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("adds a cron job successfully", async () => {
    const fakeStore = { version: 1, jobs: [] };
    vi.mocked(store.loadCronStore).mockResolvedValue(fakeStore as any);
    vi.mocked(store.saveCronStore).mockResolvedValue();

    const job = await cronService.add({}, mockWorkspace, {
      name: "Test Add",
      schedule: { kind: "every", intervalMs: 5000 },
      payload: { type: "text", text: "testing" },
      sessionTarget: "target1",
      wakeMode: "foreground"
    });

    expect(job).not.toBeNull();
    expect(job.name).toBe("Test Add");
    expect(fakeStore.jobs.length).toBe(1);
    expect(store.saveCronStore).toHaveBeenCalled();
  });

  it("lists cron jobs with pagination", async () => {
    const fakeStore = {
      version: 1,
      jobs: [
        { id: "1", createdAtMs: 200, sessionTarget: "target1" },
        { id: "2", createdAtMs: 100, sessionTarget: "target1" }
      ]
    };
    vi.mocked(store.loadCronStore).mockResolvedValue(fakeStore as any);

    const result = await cronService.listPage({}, mockWorkspace, { limit: 1 });
    
    expect(result.items.length).toBe(1);
    expect(result.items[0].id).toBe("1"); // Sorted by recency
    expect(result.nextCursor).toBe("2");
  });

  it("removes a cron job", async () => {
    const fakeStore = { version: 1, jobs: [{ id: "job1" }] };
    vi.mocked(store.loadCronStore).mockResolvedValue(fakeStore as any);
    vi.mocked(store.saveCronStore).mockResolvedValue();

    const result = await cronService.remove({}, mockWorkspace, "job1");
    
    expect(result).toBe(true);
    expect(fakeStore.jobs.length).toBe(0);
    expect(store.saveCronStore).toHaveBeenCalled();
  });
});
