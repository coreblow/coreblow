// @ts-nocheck
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, vi , Mock } from "vitest";
import type { DeliverFn, RecoveryLogger } from "./delivery-queue.js";

export function installDeliveryQueueTmpDirHooks(): { readonly tmpDir: () => string } {
  let tmpDir = "";
  let fixtureRoot = "";
  let fixtureCount = 0;

  beforeAll(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-dq-suite-"));
  });

  beforeEach(() => {
    tmpDir = path.join(fixtureRoot, `case-${fixtureCount++}`);
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterAll(() => {
    if (!fixtureRoot) {
      return;
    }
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
    fixtureRoot = "";
  });

  return {
    tmpDir: () => tmpDir,
  };
}

export function readQueuedEntry(tmpDir: string, id: string): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(path.join(tmpDir, "delivery-queue", `${id}.json`), "utf-8"),
  ) as Record<string, unknown>;
}

export function setQueuedEntryState(
  tmpDir: string,
  id: string,
  state: { retryCount: number; lastAttemptAt?: number; enqueuedAt?: number },
): void {
  const filePath = path.join(tmpDir, "delivery-queue", `${id}.json`);
  const entry = readQueuedEntry(tmpDir, id);
  entry.retryCount = state.retryCount;
  if (state.lastAttemptAt === undefined) {
    delete entry.lastAttemptAt;
  } else {
    entry.lastAttemptAt = state.lastAttemptAt;
  }
  if (state.enqueuedAt !== undefined) {
    entry.enqueuedAt = state.enqueuedAt;
  }
  fs.writeFileSync(filePath, JSON.stringify(entry), "utf-8");
}

export function createRecoveryLog(): RecoveryLogger & {
  info: Mock;
  warn: Mock;
  error: Mock;
} {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

export function asDeliverFn(deliver: Mock): DeliverFn {
  return deliver as DeliverFn;
}
