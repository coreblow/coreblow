import fs from "node:fs/promises";
import path from "node:path";
import { vi } from "vitest";
import type { RuntimeEnv } from "../runtime.js";
import * as backupShared from "./backup-shared.js";
import { resolveBackupPlanFromPaths } from "./backup-shared.js";

import type { MockFn } from "../test-utils/vitest-mock-fn.js";

const backupTestMocks = vi.hoisted(() => ({
  backupVerifyCommandMock: vi.fn(),
  tarCreateMock: vi.fn(),
}));

export const backupVerifyCommandMock: MockFn = backupTestMocks.backupVerifyCommandMock;
export const tarCreateMock: MockFn = backupTestMocks.tarCreateMock;

vi.mock("tar", () => ({
  c: backupTestMocks.tarCreateMock,
}));

vi.mock("./backup-verify.js", () => ({
  backupVerifyCommand: backupTestMocks.backupVerifyCommandMock,
}));

export function createBackupTestRuntime(): RuntimeEnv {
  return {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn(),
  } satisfies RuntimeEnv;
}

export async function resetBackupTempHome(tempHome: { home: string }) {
  await fs.rm(tempHome.home, { recursive: true, force: true });
  await fs.mkdir(path.join(tempHome.home, ".coreblow"), { recursive: true });
  delete process.env.COREBLOW_CONFIG_PATH;
}

export async function mockStateOnlyBackupPlan(stateDir: string) {
  await fs.writeFile(path.join(stateDir, "coreblow.json"), JSON.stringify({}), "utf8");
  vi.spyOn(backupShared, "resolveBackupPlanFromDisk").mockResolvedValue(
    await resolveBackupPlanFromPaths({
      stateDir,
      configPath: path.join(stateDir, "coreblow.json"),
      oauthDir: path.join(stateDir, "credentials"),
      includeWorkspace: false,
      configInsideState: true,
      oauthInsideState: true,
      nowMs: 123,
    }),
  );
}
