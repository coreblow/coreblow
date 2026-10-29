import { vi } from "vitest";

vi.mock("../../infra/file-lock.js", () => ({
  drainFileLockStateForTest: async () => undefined,
  resetFileLockStateForTest: () => undefined,
  withFileLock: async <T>(_filePath: string, _options: unknown, run: () => Promise<T>) => run(),
}));

vi.mock("../../plugin-sdk/file-lock.js", () => ({
  drainFileLockStateForTest: async () => undefined,
  resetFileLockStateForTest: () => undefined,
  withFileLock: async <T>(_filePath: string, _options: unknown, run: () => Promise<T>) => run(),
}));
