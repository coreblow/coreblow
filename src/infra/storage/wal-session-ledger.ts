import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { resolveStateDir } from "../../config/paths.js";
import type { GatewayService, ServiceHealth } from "../../gateway/service-registry.js";

export type WalEventType =
  | "turn"
  | "tool_call"
  | "tool_result"
  | "telemetry"
  | "compaction"
  | "system";

export interface WalSessionRecord<T = unknown> {
  sequence: number;
  sessionId: string;
  timestamp: number;
  eventType: WalEventType;
  agentId: string;
  subagentId?: string;
  payload: T;
  checksum: string;
}

export interface WalSessionMeta {
  sessionId: string;
  agentId: string;
  createdTimestamp: number;
  lastUpdatedTimestamp: number;
  lastSequence: number;
  totalEvents: number;
  checkpointSequence?: number;
}

export interface WalCheckpointResult {
  sessionId: string;
  checkpointSequence: number;
  recordsArchived: number;
  snapshotPath: string;
}

export interface WalSessionLedgerOptions {
  baseDir?: string;
  flushIntervalMs?: number;
  maxBatchSize?: number;
  syncOnWrite?: boolean;
}

interface QueuedWrite {
  record: WalSessionRecord;
  resolve: (record: WalSessionRecord) => void;
  reject: (error: Error) => void;
}

class SessionChannel {
  public lastSequence = 0;
  public totalEvents = 0;
  public createdTimestamp = Date.now();
  public lastUpdatedTimestamp = Date.now();
  public primaryAgentId = "main";
  public readonly queue: QueuedWrite[] = [];
  public flushPromise: Promise<void> | null = null;
  public initialized = false;

  constructor(
    public readonly sessionId: string,
    public readonly sessionDir: string,
    public readonly walFilePath: string,
    public readonly metaFilePath: string,
  ) {}
}

export class WalSessionLedger implements GatewayService {
  public readonly name = "wal-session-ledger";
  private readonly baseDir: string;
  private readonly flushIntervalMs: number;
  private readonly maxBatchSize: number;
  private readonly syncOnWrite: boolean;

  private isRunning = false;
  private lastError: string | null = null;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private readonly channels = new Map<string, SessionChannel>();

  constructor(options: WalSessionLedgerOptions = {}) {
    this.baseDir = options.baseDir ?? path.join(resolveStateDir(), "sessions");
    this.flushIntervalMs = options.flushIntervalMs ?? 50;
    this.maxBatchSize = options.maxBatchSize ?? 100;
    this.syncOnWrite = options.syncOnWrite ?? false;
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    try {
      await fs.mkdir(this.baseDir, { recursive: true, mode: 0o700 });
      this.isRunning = true;
      this.lastError = null;

      if (this.flushIntervalMs > 0) {
        this.flushTimer = setInterval(() => {
          void this.flushAllPending();
        }, this.flushIntervalMs);
      }
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flushAllPending();
    this.channels.clear();
    this.isRunning = false;
  }

  public health(): ServiceHealth {
    if (!this.isRunning) {
      return { status: "down", detail: "WAL Session Ledger service is stopped." };
    }
    if (this.lastError) {
      return { status: "degraded", detail: `WAL write or flush warning: ${this.lastError}` };
    }
    return {
      status: "healthy",
      detail: `Operating normally across ${this.channels.size} active session channels.`,
    };
  }

  public async append<T>(
    sessionId: string,
    entry: {
      eventType: WalEventType;
      agentId: string;
      subagentId?: string;
      payload: T;
      timestamp?: number;
    },
  ): Promise<WalSessionRecord<T>> {
    const [record] = await this.appendBatch<T>(sessionId, [entry]);
    if (!record) {
      throw new Error(`Failed to append record to session ${sessionId}`);
    }
    return record;
  }

  public async appendBatch<T>(
    sessionId: string,
    entries: Array<{
      eventType: WalEventType;
      agentId: string;
      subagentId?: string;
      payload: T;
      timestamp?: number;
    }>,
  ): Promise<WalSessionRecord<T>[]> {
    if (entries.length === 0) return [];
    const channel = await this.getOrInitChannel(sessionId);

    const promises: Promise<WalSessionRecord>[] = [];
    const records: WalSessionRecord<T>[] = [];

    for (const entry of entries) {
      channel.lastSequence += 1;
      channel.totalEvents += 1;
      const now = entry.timestamp ?? Date.now();
      channel.lastUpdatedTimestamp = Math.max(channel.lastUpdatedTimestamp, now);
      if (entry.agentId) {
        channel.primaryAgentId = entry.agentId;
      }

      const checksum = this.computePayloadChecksum(entry.payload);
      const record: WalSessionRecord<T> = {
        sequence: channel.lastSequence,
        sessionId,
        timestamp: now,
        eventType: entry.eventType,
        agentId: entry.agentId,
        subagentId: entry.subagentId,
        payload: entry.payload,
        checksum,
      };
      records.push(record);

      const promise = new Promise<WalSessionRecord>((resolve, reject) => {
        channel.queue.push({
          record: record as WalSessionRecord,
          resolve: resolve as (r: WalSessionRecord) => void,
          reject,
        });
      });
      promises.push(promise);
    }

    if (this.syncOnWrite || channel.queue.length >= this.maxBatchSize) {
      await this.flushChannel(channel);
    } else {
      void this.triggerAsyncFlush(channel);
    }

    await Promise.all(promises);
    return records;
  }

  public async flush(sessionId?: string): Promise<void> {
    if (sessionId) {
      const channel = this.channels.get(sessionId);
      if (channel) {
        await this.flushChannel(channel);
      }
      return;
    }
    await this.flushAllPending();
  }

  public async replaySession(sessionId: string, fromSequence = 1): Promise<WalSessionRecord[]> {
    await this.flush(sessionId);
    const sessionDir = path.join(this.baseDir, sessionId);
    const walFilePath = path.join(sessionDir, "wal.log");

    let raw = "";
    try {
      raw = await fs.readFile(walFilePath, "utf8");
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw err;
    }

    const lines = raw.split("\n").filter((line) => line.trim().length > 0);
    const records: WalSessionRecord[] = [];

    for (const line of lines) {
      const parsed = JSON.parse(line) as WalSessionRecord;
      if (parsed.sequence >= fromSequence) {
        const expectedChecksum = this.computePayloadChecksum(parsed.payload);
        if (parsed.checksum && parsed.checksum !== expectedChecksum) {
          throw new Error(
            `WAL checksum mismatch in session ${sessionId} at sequence ${parsed.sequence}: expected ${expectedChecksum}, got ${parsed.checksum}`,
          );
        }
        records.push(parsed);
      }
    }

    records.sort((a, b) => a.sequence - b.sequence);
    return records;
  }

  public async getSessionMeta(sessionId: string): Promise<WalSessionMeta | null> {
    await this.flush(sessionId);
    const metaPath = path.join(this.baseDir, sessionId, "session.meta.json");
    try {
      const content = await fs.readFile(metaPath, "utf8");
      return JSON.parse(content) as WalSessionMeta;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw err;
    }
  }

  public async checkpoint(sessionId: string, upToSequence?: number): Promise<WalCheckpointResult> {
    await this.flush(sessionId);
    const channel = await this.getOrInitChannel(sessionId);
    const targetSeq = upToSequence ?? channel.lastSequence;

    const allRecords = await this.replaySession(sessionId, 1);
    const toArchive = allRecords.filter((r) => r.sequence <= targetSeq);
    const toKeep = allRecords.filter((r) => r.sequence > targetSeq);

    const snapshotDir = path.join(channel.sessionDir, "snapshots");
    await fs.mkdir(snapshotDir, { recursive: true, mode: 0o700 });
    const snapshotPath = path.join(snapshotDir, `snapshot-seq-${targetSeq}-${Date.now()}.json`);

    await fs.writeFile(snapshotPath, JSON.stringify(toArchive, null, 2), "utf8");

    const newWalContent = toKeep.map((r) => JSON.stringify(r)).join("\n") + (toKeep.length > 0 ? "\n" : "");
    await fs.writeFile(channel.walFilePath, newWalContent, "utf8");

    const meta: WalSessionMeta = {
      sessionId,
      agentId: channel.primaryAgentId,
      createdTimestamp: channel.createdTimestamp,
      lastUpdatedTimestamp: Date.now(),
      lastSequence: channel.lastSequence,
      totalEvents: channel.totalEvents,
      checkpointSequence: targetSeq,
    };
    await this.writeMetaAtomic(channel.metaFilePath, meta);

    return {
      sessionId,
      checkpointSequence: targetSeq,
      recordsArchived: toArchive.length,
      snapshotPath,
    };
  }

  private async getOrInitChannel(sessionId: string): Promise<SessionChannel> {
    let channel = this.channels.get(sessionId);
    if (channel && channel.initialized) {
      return channel;
    }

    const sessionDir = path.join(this.baseDir, sessionId);
    const walFilePath = path.join(sessionDir, "wal.log");
    const metaFilePath = path.join(sessionDir, "session.meta.json");

    if (!channel) {
      channel = new SessionChannel(sessionId, sessionDir, walFilePath, metaFilePath);
      this.channels.set(sessionId, channel);
    }

    if (!channel.initialized) {
      await fs.mkdir(sessionDir, { recursive: true, mode: 0o700 });
      try {
        const metaRaw = await fs.readFile(metaFilePath, "utf8");
        const meta = JSON.parse(metaRaw) as WalSessionMeta;
        channel.lastSequence = meta.lastSequence ?? 0;
        channel.totalEvents = meta.totalEvents ?? 0;
        channel.createdTimestamp = meta.createdTimestamp ?? Date.now();
        channel.lastUpdatedTimestamp = meta.lastUpdatedTimestamp ?? Date.now();
        channel.primaryAgentId = meta.agentId ?? "main";
      } catch {
        // First initialization for this session
        channel.createdTimestamp = Date.now();
        channel.lastUpdatedTimestamp = Date.now();
      }
      channel.initialized = true;
    }

    return channel;
  }

  private triggerAsyncFlush(channel: SessionChannel): Promise<void> {
    if (!channel.flushPromise) {
      channel.flushPromise = this.flushChannel(channel)
        .catch((err) => {
          this.lastError = err instanceof Error ? err.message : String(err);
        })
        .finally(() => {
          channel.flushPromise = null;
        });
    }
    return channel.flushPromise;
  }

  private async flushChannel(channel: SessionChannel): Promise<void> {
    if (channel.queue.length === 0) return;

    const batch = channel.queue.splice(0, channel.queue.length);
    const lines = batch.map((item) => JSON.stringify(item.record)).join("\n") + "\n";

    try {
      await fs.mkdir(channel.sessionDir, { recursive: true, mode: 0o700 });
      await fs.appendFile(channel.walFilePath, lines, "utf8");

      const meta: WalSessionMeta = {
        sessionId: channel.sessionId,
        agentId: channel.primaryAgentId,
        createdTimestamp: channel.createdTimestamp,
        lastUpdatedTimestamp: channel.lastUpdatedTimestamp,
        lastSequence: channel.lastSequence,
        totalEvents: channel.totalEvents,
      };
      await this.writeMetaAtomic(channel.metaFilePath, meta);

      for (const item of batch) {
        item.resolve(item.record);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.lastError = error.message;
      for (const item of batch) {
        item.reject(error);
      }
      throw error;
    }
  }

  private async flushAllPending(): Promise<void> {
    const flushes: Promise<void>[] = [];
    for (const channel of this.channels.values()) {
      if (channel.queue.length > 0) {
        flushes.push(
          this.flushChannel(channel).catch((err) => {
            this.lastError = err instanceof Error ? err.message : String(err);
          }),
        );
      }
    }
    if (flushes.length > 0) {
      await Promise.all(flushes);
    }
  }

  private async writeMetaAtomic(metaFilePath: string, meta: WalSessionMeta): Promise<void> {
    const tmpPath = `${metaFilePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
    await fs.writeFile(tmpPath, JSON.stringify(meta, null, 2), "utf8");
    await fs.rename(tmpPath, metaFilePath);
  }

  private computePayloadChecksum(payload: unknown): string {
    const raw = typeof payload === "string" ? payload : JSON.stringify(payload ?? "");
    return createHash("sha256").update(raw).digest("hex");
  }
}

let globalWalLedger: WalSessionLedger | null = null;

export function getGlobalWalSessionLedger(options?: WalSessionLedgerOptions): WalSessionLedger {
  if (!globalWalLedger) {
    globalWalLedger = new WalSessionLedger(options);
  }
  return globalWalLedger;
}
