import type { CoreBlowConfig } from "../../config/config.js";
import {
  ackDelivery,
  failDelivery,
  loadPendingDelivery,
  loadPendingDeliveries,
  moveToFailed,
  type QueuedDelivery,
  type QueuedDeliveryPayload,
} from "./delivery-queue-storage.js";

export type RecoverySummary = {
  recovered: number;
  failed: number;
  skippedMaxRetries: number;
  deferredBackoff: number;
};

export type DeliverFn = (
  params: {
    cfg: CoreBlowConfig;
  } & QueuedDeliveryPayload & {
      skipQueue?: boolean;
    },
) => Promise<unknown>;

export interface RecoveryLogger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

export interface PendingDeliveryDrainDecision {
  match: boolean;
  bypassBackoff?: boolean;
}

export type ActiveDeliveryClaimResult<T> =
  | { status: "claimed"; value: T }
  | { status: "claimed-by-other-owner" };

const MAX_RETRIES = 5;

const drainInProgress = new Map<string, boolean>();
const entriesInProgress = new Set<string>();

function claimRecoveryEntry(entryId: string): boolean {
  if (entriesInProgress.has(entryId)) {
    return false;
  }
  entriesInProgress.add(entryId);
  return true;
}

function releaseRecoveryEntry(entryId: string): void {
  entriesInProgress.delete(entryId);
}

export async function withActiveDeliveryClaim<T>(
  entryId: string,
  fn: () => Promise<T>,
): Promise<ActiveDeliveryClaimResult<T>> {
  if (!claimRecoveryEntry(entryId)) {
    return { status: "claimed-by-other-owner" };
  }

  try {
    return { status: "claimed", value: await fn() };
  } finally {
    releaseRecoveryEntry(entryId);
  }
}

/** Backoff delays in milliseconds indexed by retry count (1-based). */
const BACKOFF_MS: readonly number[] = [
  5_000, // retry 1: 5s
  25_000, // retry 2: 25s
  120_000, // retry 3: 2m
  600_000, // retry 4: 10m
];

const PERMANENT_ERROR_PATTERNS: readonly RegExp[] = [
  /no conversation reference found/i,
  /chat not found/i,
  /user not found/i,
  /bot.*not.*member/i,
  /bot was blocked by the user/i,
  /forbidden: bot was kicked/i,
  /chat_id is empty/i,
  /recipient is not a valid/i,
  /outbound not configured for channel/i,
  /ambiguous discord recipient/i,
];

function createEmptyRecoverySummary(): RecoverySummary {
  return {
    recovered: 0,
    failed: 0,
    skippedMaxRetries: 0,
    deferredBackoff: 0,
  };
}

function buildRecoveryDeliverParams(entry: QueuedDelivery, cfg: CoreBlowConfig) {
  return {
    cfg,
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
    skipQueue: true, // Prevent re-enqueueing during recovery.
  } satisfies Parameters<DeliverFn>[0];
}

async function moveEntryToFailedWithLogging(
  entryId: string,
  log: RecoveryLogger,
  stateDir?: string,
): Promise<void> {
  try {
    await moveToFailed(entryId, stateDir);
  } catch (err) {
    log.error(`Failed to move entry ${entryId} to failed/: ${String(err)}`);
  }
}

async function deferRemainingEntriesForBudget(
  entries: readonly QueuedDelivery[],
  stateDir: string | undefined,
): Promise<void> {
  // Increment retryCount so entries that are repeatedly deferred by the
  // recovery budget eventually hit MAX_RETRIES and get pruned.
  await Promise.allSettled(
    entries.map((entry) => failDelivery(entry.id, "recovery time budget exceeded", stateDir)),
  );
}

/** Compute the backoff delay in ms for a given retry count. */
export function computeBackoffMs(retryCount: number): number {
  if (retryCount <= 0) {
    return 0;
  }
  return BACKOFF_MS[Math.min(retryCount - 1, BACKOFF_MS.length - 1)] ?? BACKOFF_MS.at(-1) ?? 0;
}

export function isEntryEligibleForRecoveryRetry(
  entry: QueuedDelivery,
  now: number,
): { eligible: true } | { eligible: false; remainingBackoffMs: number } {
  const backoff = computeBackoffMs(entry.retryCount + 1);
  if (backoff <= 0) {
    return { eligible: true };
  }
  const firstReplayAfterCrash = entry.retryCount === 0 && entry.lastAttemptAt === undefined;
  if (firstReplayAfterCrash) {
    return { eligible: true };
  }
  const hasAttemptTimestamp =
    typeof entry.lastAttemptAt === "number" &&
    Number.isFinite(entry.lastAttemptAt) &&
    entry.lastAttemptAt > 0;
  const baseAttemptAt = hasAttemptTimestamp
    ? (entry.lastAttemptAt ?? entry.enqueuedAt)
    : entry.enqueuedAt;
  const nextEligibleAt = baseAttemptAt + backoff;
  if (now >= nextEligibleAt) {
    return { eligible: true };
  }
  return { eligible: false, remainingBackoffMs: nextEligibleAt - now };
}

export function isPermanentDeliveryError(error: string): boolean {
  return PERMANENT_ERROR_PATTERNS.some((re) => re.test(error));
}

async function drainQueuedEntry(opts: {
  entry: QueuedDelivery;
  cfg: CoreBlowConfig;
  deliver: DeliverFn;
  log: RecoveryLogger;
  stateDir?: string;
  onRecovered?: (entry: QueuedDelivery) => void;
  onFailed?: (entry: QueuedDelivery, errMsg: string) => void;
}): Promise<"recovered" | "failed" | "moved-to-failed" | "already-gone"> {
  const { entry } = opts;
  if (
    entry.recoveryState === "send_attempt_started" ||
    entry.recoveryState === "unknown_after_send"
  ) {
    const errMsg = `delivery state is ${entry.recoveryState}; refusing blind replay without adapter reconciliation`;
    opts.log.warn(`Delivery entry ${entry.id} ${errMsg}`);
    opts.onFailed?.(entry, errMsg);
    try {
      await moveToFailed(entry.id, opts.stateDir);
      return "moved-to-failed";
    } catch (moveErr) {
      const code =
        moveErr && typeof moveErr === "object" && "code" in moveErr
          ? String((moveErr as { code?: unknown }).code)
          : null;
      if (code === "ENOENT") {
        return "already-gone";
      }
    }
    return "failed";
  }

  try {
    await opts.deliver(buildRecoveryDeliverParams(entry, opts.cfg));
    await ackDelivery(entry.id, opts.stateDir);
    opts.onRecovered?.(entry);
    return "recovered";
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    opts.onFailed?.(entry, errMsg);
    if (isPermanentDeliveryError(errMsg)) {
      try {
        await moveToFailed(entry.id, opts.stateDir);
        return "moved-to-failed";
      } catch (moveErr) {
        const code =
          moveErr && typeof moveErr === "object" && "code" in moveErr
            ? String((moveErr as { code?: unknown }).code)
            : null;
        if (code === "ENOENT") {
          return "already-gone";
        }
      }
    } else {
      try {
        await failDelivery(entry.id, errMsg, opts.stateDir);
        return "failed";
      } catch (failErr) {
        const code =
          failErr && typeof failErr === "object" && "code" in failErr
            ? String((failErr as { code?: unknown }).code)
            : null;
        if (code === "ENOENT") {
          return "already-gone";
        }
      }
    }
    return "failed";
  }
}

export async function drainPendingDeliveries(opts: {
  drainKey: string;
  logLabel: string;
  cfg: CoreBlowConfig;
  log: RecoveryLogger;
  stateDir?: string;
  deliver: DeliverFn;
  selectEntry: (entry: QueuedDelivery, now: number) => PendingDeliveryDrainDecision;
}): Promise<void> {
  if (drainInProgress.get(opts.drainKey)) {
    opts.log.info(`${opts.logLabel}: already in progress for ${opts.drainKey}, skipping`);
    return;
  }

  drainInProgress.set(opts.drainKey, true);
  try {
    const now = Date.now();
    const deliver = opts.deliver;
    const matchingEntries = (await loadPendingDeliveries(opts.stateDir))
      .filter((entry) => opts.selectEntry(entry, now).match)
      .sort((a, b) => a.enqueuedAt - b.enqueuedAt);

    if (matchingEntries.length === 0) {
      return;
    }

    opts.log.info(
      `${opts.logLabel}: ${matchingEntries.length} pending message(s) matched ${opts.drainKey}`,
    );

    for (const entry of matchingEntries) {
      if (!claimRecoveryEntry(entry.id)) {
        opts.log.info(`${opts.logLabel}: entry ${entry.id} is already being recovered`);
        continue;
      }

      try {
        const currentEntry = await loadPendingDelivery(entry.id, opts.stateDir);
        if (!currentEntry) {
          opts.log.info(`${opts.logLabel}: entry ${entry.id} already gone, skipping`);
          continue;
        }

        const currentDecision = opts.selectEntry(currentEntry, Date.now());
        if (!currentDecision.match) {
          opts.log.info(`${opts.logLabel}: entry ${currentEntry.id} no longer matches, skipping`);
          continue;
        }

        if (currentEntry.retryCount >= MAX_RETRIES) {
          try {
            await moveToFailed(currentEntry.id, opts.stateDir);
          } catch (err) {
            const code =
              err && typeof err === "object" && "code" in err
                ? String((err as { code?: unknown }).code)
                : null;
            if (code === "ENOENT") {
              opts.log.info(`${opts.logLabel}: entry ${currentEntry.id} already gone, skipping`);
              continue;
            }
            throw err;
          }
          opts.log.warn(
            `${opts.logLabel}: entry ${currentEntry.id} exceeded max retries and was moved to failed/`,
          );
          continue;
        }

        if (!currentDecision.bypassBackoff) {
          const retryEligibility = isEntryEligibleForRecoveryRetry(currentEntry, Date.now());
          if (!retryEligibility.eligible) {
            opts.log.info(
              `${opts.logLabel}: entry ${currentEntry.id} not ready for retry yet — backoff ${retryEligibility.remainingBackoffMs}ms remaining`,
            );
            continue;
          }
        }

        const result = await drainQueuedEntry({
          entry: currentEntry,
          cfg: opts.cfg,
          deliver,
          log: opts.log,
          stateDir: opts.stateDir,
          onFailed: (failedEntry, errMsg) => {
            if (isPermanentDeliveryError(errMsg)) {
              opts.log.warn(
                `${opts.logLabel}: entry ${failedEntry.id} hit permanent error — moving to failed/: ${errMsg}`,
              );
              return;
            }
            opts.log.warn(`${opts.logLabel}: retry failed for entry ${failedEntry.id}: ${errMsg}`);
          },
        });
        if (result === "recovered") {
          opts.log.info(
            `${opts.logLabel}: drained delivery ${currentEntry.id} on ${currentEntry.channel}`,
          );
        }
      } finally {
        releaseRecoveryEntry(entry.id);
      }
    }
  } finally {
    drainInProgress.delete(opts.drainKey);
  }
}

/**
 * On gateway startup, scan the delivery queue and retry any pending entries.
 * Uses exponential backoff and moves entries that exceed MAX_RETRIES to failed/.
 */
export async function recoverPendingDeliveries(opts: {
  deliver: DeliverFn;
  log: RecoveryLogger;
  cfg: CoreBlowConfig;
  stateDir?: string;
  /** Maximum wall-clock time for recovery in ms. Remaining entries are deferred to next startup. Default: 60 000. */
  maxRecoveryMs?: number;
}): Promise<RecoverySummary> {
  const pending = await loadPendingDeliveries(opts.stateDir);
  if (pending.length === 0) {
    return createEmptyRecoverySummary();
  }

  pending.sort((a, b) => a.enqueuedAt - b.enqueuedAt);
  opts.log.info(`Found ${pending.length} pending delivery entries — starting recovery`);

  const deadline = Date.now() + (opts.maxRecoveryMs ?? 60_000);
  const summary = createEmptyRecoverySummary();

  for (let i = 0; i < pending.length; i++) {
    const entry = pending[i];
    const now = Date.now();
    if (now >= deadline) {
      opts.log.warn(`Recovery time budget exceeded — remaining entries deferred to next startup`);
      await deferRemainingEntriesForBudget(pending.slice(i), opts.stateDir);
      break;
    }

    if (!claimRecoveryEntry(entry.id)) {
      opts.log.info(`Recovery skipped for delivery ${entry.id}: already being processed`);
      continue;
    }

    try {
      const currentEntry = await loadPendingDelivery(entry.id, opts.stateDir);
      if (!currentEntry) {
        opts.log.info(`Recovery skipped for delivery ${entry.id}: already processed`);
        continue;
      }

      if (currentEntry.retryCount >= MAX_RETRIES) {
        opts.log.warn(
          `Delivery ${currentEntry.id} exceeded max retries (${currentEntry.retryCount}/${MAX_RETRIES}) — moving to failed/`,
        );
        await moveEntryToFailedWithLogging(currentEntry.id, opts.log, opts.stateDir);
        summary.skippedMaxRetries += 1;
        continue;
      }

      const retryEligibility = isEntryEligibleForRecoveryRetry(currentEntry, now);
      if (!retryEligibility.eligible) {
        summary.deferredBackoff += 1;
        opts.log.info(
          `Delivery ${currentEntry.id} not ready for retry yet — backoff ${retryEligibility.remainingBackoffMs}ms remaining`,
        );
        continue;
      }

      try {
        await opts.deliver(buildRecoveryDeliverParams(currentEntry, opts.cfg));
        await ackDelivery(currentEntry.id, opts.stateDir);
        summary.recovered += 1;
        opts.log.info(
          `Recovered delivery ${currentEntry.id} to ${currentEntry.channel}:${currentEntry.to}`,
        );
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (isPermanentDeliveryError(errMsg)) {
          opts.log.warn(
            `Delivery ${currentEntry.id} hit permanent error — moving to failed/: ${errMsg}`,
          );
          await moveEntryToFailedWithLogging(currentEntry.id, opts.log, opts.stateDir);
          summary.failed += 1;
          continue;
        }
        try {
          await failDelivery(currentEntry.id, errMsg, opts.stateDir);
        } catch {
          // Best-effort update.
        }
        summary.failed += 1;
        opts.log.warn(`Retry failed for delivery ${currentEntry.id}: ${errMsg}`);
      }
    } finally {
      releaseRecoveryEntry(entry.id);
    }
  }

  opts.log.info(
    `Delivery recovery complete: ${summary.recovered} recovered, ${summary.failed} failed, ${summary.skippedMaxRetries} skipped (max retries), ${summary.deferredBackoff} deferred (backoff)`,
  );
  return summary;
}

export { MAX_RETRIES };

// ---------------------------------------------------------------------------
// DeliveryQueueRecoveryService — Tier-1 Standalone Singleton
// ---------------------------------------------------------------------------

import { createStandaloneSingleton } from "../service-patterns.js";
/**
 * Tier-1 service wrapping delivery queue crash recovery logic.
 */
export class DeliveryQueueRecoveryService {
  computeBackoffMs(retryCount: number) {
    return computeBackoffMs(retryCount);
  }

  isEntryEligibleForRecoveryRetry(entry: QueuedDelivery, now: number) {
    return isEntryEligibleForRecoveryRetry(entry, now);
  }

  isPermanentDeliveryError(error: string) {
    return isPermanentDeliveryError(error);
  }

  async recoverPendingDeliveries(opts: Parameters<typeof recoverPendingDeliveries>[0]) {
    return recoverPendingDeliveries(opts);
  }
}


const { getInstance: getDeliveryQueueRecoveryService, __testing: __testing_deliveryQueueRecovery } =
  createStandaloneSingleton({ create: () => new DeliveryQueueRecoveryService(), defaultDeps: {} });

export { getDeliveryQueueRecoveryService, __testing_deliveryQueueRecovery };
