import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { resolveCronStorePath, loadCronStore, saveCronStore } from "../../src/cron/store.js";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      rename: vi.fn(),
      mkdir: vi.fn(),
      chmod: vi.fn().mockReturnValue({ catch: vi.fn() })
    }
  };
});

describe("cron store", () => {
  const mockWorkspace = "/mock/workspace";
  const mockConfigDir = path.join(os.homedir(), ".coreblow");

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("resolves store path correctly with workspace", () => {
    const p = resolveCronStorePath(mockWorkspace);
    expect(p).toBe(mockWorkspace);
  });

  it("resolves store path correctly without workspace", () => {
    const p = resolveCronStorePath();
    expect(p).toBe(path.join(mockConfigDir, "cron", "jobs.json"));
  });

  it("loads empty store if file not found", async () => {
    vi.mocked(fs.promises.readFile).mockRejectedValue({ code: "ENOENT" });
    const store = await loadCronStore(mockWorkspace);
    expect(store.version).toBe(1);
    expect(store.jobs).toEqual([]);
  });

  it("loads existing store successfully", async () => {
    const fakeStore = { version: 1, jobs: [{ id: "job1" }] };
    vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(fakeStore));
    const store = await loadCronStore(mockWorkspace);
    expect(store.jobs[0].id).toBe("job1");
  });

  it("saves store atomic-like", async () => {
    const fakeStore = { version: 1 as const, jobs: [] };
    vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined as void);
    vi.mocked(fs.promises.rename).mockResolvedValue(undefined as void);
    vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
    
    await saveCronStore(mockWorkspace, fakeStore);
    
    expect(fs.promises.writeFile).toHaveBeenCalled();
    expect(fs.promises.rename).toHaveBeenCalled();
    expect(fs.promises.mkdir).toHaveBeenCalled();
  });
});
