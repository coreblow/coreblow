import {
  ackDelivery,
  failDelivery,
  isEntryEligibleForRecoveryRetry,
  isPermanentDeliveryError,
  loadPendingDeliveries,
  MAX_RETRIES,
  moveToFailed,
  type DeliverFn,
  type QueuedDelivery,
  type RecoveryLogger,
} from "../infra/outbound/delivery-queue.js";
import type { CoreBlowConfig } from "../config/config.js";

export type PendingDeliveryDrainDecision = {
  match: boolean;
  bypassBackoff?: boolean;
};

type Options = {
  drainKey: string;
  logLabel: string;
  cfg: CoreBlowConfig;
  log: RecoveryLogger;
  stateDir?: string;
  deliver?: DeliverFn;
  selectEntry: (entry: QueuedDelivery, now: number) => PendingDeliveryDrainDecision;
};

const activeDrains = new Set<string>();

export async function drainPendingDeliveries(options: Options): Promise<void> {
  if (activeDrains.has(options.drainKey)) {
    options.log.info(`${options.logLabel}: already in progress for ${options.drainKey}, skipping`);
    return;
  }

  const deliver =
    options.deliver ??
    (await import("../infra/outbound/deliver-runtime.js")).deliverOutboundPayloads;

  activeDrains.add(options.drainKey);
  try {
    const entries = (await loadPendingDeliveries(options.stateDir))
      .filter((entry) => options.selectEntry(entry, Date.now()).match)
      .sort((a, b) => a.enqueuedAt - b.enqueuedAt);

    for (const entry of entries) {
      const decision = options.selectEntry(entry, Date.now());
      if (!decision.match) {
        continue;
      }
      if (entry.retryCount >= MAX_RETRIES) {
        await moveToFailed(entry.id, options.stateDir);
        continue;
      }
      if (
        !decision.bypassBackoff &&
        !isEntryEligibleForRecoveryRetry(entry, Date.now()).eligible
      ) {
        continue;
      }
      try {
        await deliver({
          cfg: options.cfg,
          channel: entry.channel,
          to: entry.to,
          accountId: entry.accountId,
          payloads: entry.payloads,
          threadId: entry.threadId,
          replyToId: entry.replyToId,
          bestEffort: entry.bestEffort,
          gifPlayback: entry.gifPlayback,
          forceDocument: entry.forceDocument,
          silent: entry.silent,
          mirror: entry.mirror,
          gatewayClientScopes: entry.gatewayClientScopes,
          skipQueue: true,
        });
        await ackDelivery(entry.id, options.stateDir);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isPermanentDeliveryError(message)) {
          await moveToFailed(entry.id, options.stateDir);
        } else {
          await failDelivery(entry.id, message, options.stateDir);
        }
      }
    }
  } finally {
    activeDrains.delete(options.drainKey);
  }
}
