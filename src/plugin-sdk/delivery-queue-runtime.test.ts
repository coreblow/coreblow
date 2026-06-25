import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadPendingDeliveries: vi.fn(async () => []),
}));

vi.mock("../infra/outbound/delivery-queue.js", () => ({
  ackDelivery: vi.fn(),
  failDelivery: vi.fn(),
  isEntryEligibleForRecoveryRetry: vi.fn(() => ({ eligible: true })),
  isPermanentDeliveryError: vi.fn(() => false),
  loadPendingDeliveries: mocks.loadPendingDeliveries,
  MAX_RETRIES: 5,
  moveToFailed: vi.fn(),
}));

import { drainPendingDeliveries } from "./delivery-queue-runtime.js";

const log = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe("plugin SDK delivery queue runtime", () => {
  beforeEach(() => {
    mocks.loadPendingDeliveries.mockClear();
  });

  it("uses an explicit delivery function without loading the outbound runtime", async () => {
    const deliver = vi.fn(async () => []);

    await drainPendingDeliveries({
      drainKey: "test:empty",
      logLabel: "test drain",
      cfg: {},
      log,
      deliver,
      selectEntry: () => ({ match: true }),
    });

    expect(mocks.loadPendingDeliveries).toHaveBeenCalledOnce();
    expect(deliver).not.toHaveBeenCalled();
  });
});
