import fs from "node:fs/promises";
import path from "node:path";
import type { ContentBlock, SessionUpdate } from "@agentclientprotocol/sdk";
import { resolveStateDir } from "../config/paths.js";
import { withFileLock } from "../infra/file-lock.js";
import { readJsonFile, writeTextAtomic } from "../infra/json-files.js";
import { asRecord } from "./record-shared.js";

const LEDGER_VERSION = 1;
const DEFAULT_MAX_SESSIONS = 200;
const DEFAULT_MAX_EVENTS_PER_SESSION = 5_000;
const DEFAULT_MAX_SERIALIZED_BYTES = 16 * 1024 * 1024;
const FILE_LOCK_OPTIONS = {
  retries: { retries: 8, factor: 2, minTimeout: 50, maxTimeout: 5_000, randomize: true },
  stale: 15_000,
} as const;

export type AcpEventLedgerEntry = {
  seq: number;
  at: number;
  sessionId: string;
  sessionKey: string;
  runId?: string;
  update: SessionUpdate;
};

export type AcpEventLedgerReplay = {
  complete: boolean;
  sessionId?: string;
  sessionKey?: string;
  events: AcpEventLedgerEntry[];
};

export type AcpEventLedger = {
  startSession(params: {
    sessionId: string;
    sessionKey: string;
    cwd: string;
    complete: boolean;
    reset?: boolean;
  }): Promise<void>;
  recordUserPrompt(params: {
    sessionId: string;
    sessionKey: string;
    runId: string;
    prompt: readonly ContentBlock[];
  }): Promise<void>;
  recordUpdate(params: {
    sessionId: string;
    sessionKey: string;
    runId?: string;
    update: SessionUpdate;
  }): Promise<void>;
  markIncomplete(params: { sessionId: string; sessionKey: string }): Promise<void>;
  readReplay(params: { sessionId: string; sessionKey: string }): Promise<AcpEventLedgerReplay>;
  readReplayBySessionId(params: { sessionId: string }): Promise<AcpEventLedgerReplay>;
  readReplayBySessionKey(params: { sessionKey: string }): Promise<AcpEventLedgerReplay>;
};

type LedgerSession = {
  sessionId: string;
  sessionKey: string;
  cwd: string;
  complete: boolean;
  createdAt: number;
  updatedAt: number;
  nextSeq: number;
  events: AcpEventLedgerEntry[];
};

type LedgerStore = { version: 1; sessions: Record<string, LedgerSession> };
type LedgerOptions = {
  maxSessions?: number;
  maxEventsPerSession?: number;
  maxSerializedBytes?: number;
  now?: () => number;
};

function emptyStore(): LedgerStore {
  return { version: LEDGER_VERSION, sessions: {} };
}

function normalizeOptions(options: LedgerOptions) {
  return {
    maxSessions: Math.max(1, Math.floor(options.maxSessions ?? DEFAULT_MAX_SESSIONS)),
    maxEventsPerSession: Math.max(
      1,
      Math.floor(options.maxEventsPerSession ?? DEFAULT_MAX_EVENTS_PER_SESSION),
    ),
    maxSerializedBytes: Math.max(
      1_024,
      Math.floor(options.maxSerializedBytes ?? DEFAULT_MAX_SERIALIZED_BYTES),
    ),
    now: options.now ?? Date.now,
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function normalizeEvent(value: unknown): AcpEventLedgerEntry | undefined {
  const raw = asRecord(value);
  const update = asRecord(raw?.update);
  if (
    !raw ||
    !update ||
    !Number.isInteger(raw.seq) ||
    typeof raw.seq !== "number" ||
    raw.seq < 0 ||
    typeof raw.at !== "number" ||
    !Number.isFinite(raw.at) ||
    typeof raw.sessionId !== "string" ||
    typeof raw.sessionKey !== "string" ||
    typeof update.sessionUpdate !== "string"
  ) {
    return undefined;
  }
  return {
    seq: raw.seq,
    at: raw.at,
    sessionId: raw.sessionId,
    sessionKey: raw.sessionKey,
    ...(typeof raw.runId === "string" && raw.runId ? { runId: raw.runId } : {}),
    update: clone(update) as SessionUpdate,
  };
}

function normalizeSession(value: unknown): LedgerSession | undefined {
  const raw = asRecord(value);
  if (
    !raw ||
    typeof raw.sessionId !== "string" ||
    typeof raw.sessionKey !== "string" ||
    typeof raw.cwd !== "string" ||
    typeof raw.createdAt !== "number" ||
    typeof raw.updatedAt !== "number" ||
    typeof raw.nextSeq !== "number" ||
    !Number.isInteger(raw.nextSeq) ||
    raw.nextSeq < 1
  ) {
    return undefined;
  }
  return {
    sessionId: raw.sessionId,
    sessionKey: raw.sessionKey,
    cwd: raw.cwd,
    complete: raw.complete === true,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    nextSeq: raw.nextSeq,
    events: Array.isArray(raw.events)
      ? raw.events.map(normalizeEvent).filter((event): event is AcpEventLedgerEntry => Boolean(event))
      : [],
  };
}

function normalizeStore(value: unknown): LedgerStore {
  const raw = asRecord(value);
  const rawSessions = asRecord(raw?.sessions);
  if (raw?.version !== LEDGER_VERSION || !rawSessions) {
    return emptyStore();
  }
  const sessions: Record<string, LedgerSession> = {};
  for (const [sessionId, value] of Object.entries(rawSessions)) {
    const session = normalizeSession(value);
    if (session?.sessionId === sessionId) {
      sessions[sessionId] = session;
    }
  }
  return { version: LEDGER_VERSION, sessions };
}

class AcpEventLedgerService implements AcpEventLedger {
  private store = emptyStore();
  private queue = Promise.resolve();
  private readonly options: ReturnType<typeof normalizeOptions>;

  constructor(
    options: LedgerOptions,
    private readonly filePath?: string,
  ) {
    this.options = normalizeOptions(options);
  }

  private async serial<T>(operation: () => Promise<T>): Promise<T> {
    const task = this.queue.then(operation, operation);
    this.queue = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }

  private async load(): Promise<void> {
    if (this.filePath) {
      this.store = normalizeStore(await readJsonFile(this.filePath));
    }
  }

  private async persist(): Promise<void> {
    if (!this.filePath) {
      return;
    }
    await writeTextAtomic(this.filePath, JSON.stringify(this.store), {
      mode: 0o600,
      ensureDirMode: 0o700,
    });
  }

  private getOrCreate(params: {
    sessionId: string;
    sessionKey: string;
    cwd: string;
    complete: boolean;
    reset?: boolean;
  }): LedgerSession {
    const now = this.options.now();
    const existing = this.store.sessions[params.sessionId];
    if (existing && !params.reset) {
      existing.sessionKey = params.sessionKey;
      existing.cwd = params.cwd || existing.cwd;
      existing.complete ||= params.complete;
      existing.updatedAt = now;
      return existing;
    }
    const session: LedgerSession = {
      sessionId: params.sessionId,
      sessionKey: params.sessionKey,
      cwd: params.cwd,
      complete: params.complete,
      createdAt: now,
      updatedAt: now,
      nextSeq: 1,
      events: [],
    };
    this.store.sessions[params.sessionId] = session;
    return session;
  }

  private trim(): void {
    for (const session of Object.values(this.store.sessions)) {
      if (session.events.length > this.options.maxEventsPerSession) {
        session.events = session.events.slice(-this.options.maxEventsPerSession);
        session.complete = false;
      }
    }
    const sessions = Object.values(this.store.sessions).toSorted(
      (left, right) => right.updatedAt - left.updatedAt,
    );
    for (const session of sessions.slice(this.options.maxSessions)) {
      delete this.store.sessions[session.sessionId];
    }
    while (Buffer.byteLength(JSON.stringify(this.store)) > this.options.maxSerializedBytes) {
      const oldest = Object.values(this.store.sessions)
        .filter((session) => session.events.length > 0)
        .toSorted((left, right) => left.updatedAt - right.updatedAt)[0];
      if (!oldest) {
        break;
      }
      oldest.events.shift();
      oldest.complete = false;
    }
  }

  private append(params: {
    sessionId: string;
    sessionKey: string;
    runId?: string;
    update: SessionUpdate;
  }): void {
    const session = this.getOrCreate({ ...params, cwd: "", complete: false });
    const now = this.options.now();
    session.updatedAt = now;
    session.events.push({
      seq: session.nextSeq++,
      at: now,
      sessionId: params.sessionId,
      sessionKey: params.sessionKey,
      ...(params.runId ? { runId: params.runId } : {}),
      update: clone(params.update),
    });
    this.trim();
  }

  private replay(session?: LedgerSession): AcpEventLedgerReplay {
    if (!session?.complete) {
      return { complete: false, events: [] };
    }
    return {
      complete: true,
      sessionId: session.sessionId,
      sessionKey: session.sessionKey,
      events: clone(session.events),
    };
  }

  private mutate(operation: () => void): Promise<void> {
    return this.serial(async () => {
      const run = async () => {
        await this.load();
        operation();
        await this.persist();
      };
      if (!this.filePath) {
        await run();
        return;
      }
      await fs.mkdir(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
      await withFileLock(this.filePath, FILE_LOCK_OPTIONS, run);
    });
  }

  private read(operation: () => AcpEventLedgerReplay): Promise<AcpEventLedgerReplay> {
    return this.serial(async () => {
      await this.load();
      return operation();
    });
  }

  startSession(params: Parameters<AcpEventLedger["startSession"]>[0]): Promise<void> {
    return this.mutate(() => {
      this.getOrCreate(params);
      this.trim();
    });
  }

  recordUserPrompt(params: Parameters<AcpEventLedger["recordUserPrompt"]>[0]): Promise<void> {
    return this.mutate(() => {
      for (const content of params.prompt) {
        this.append({
          sessionId: params.sessionId,
          sessionKey: params.sessionKey,
          runId: params.runId,
          update: { sessionUpdate: "user_message_chunk", content: clone(content) },
        });
      }
    });
  }

  recordUpdate(params: Parameters<AcpEventLedger["recordUpdate"]>[0]): Promise<void> {
    return this.mutate(() => this.append(params));
  }

  markIncomplete(params: Parameters<AcpEventLedger["markIncomplete"]>[0]): Promise<void> {
    return this.mutate(() => {
      const session = this.store.sessions[params.sessionId];
      if (session?.sessionKey === params.sessionKey) {
        session.complete = false;
        session.updatedAt = this.options.now();
      }
    });
  }

  readReplay(params: Parameters<AcpEventLedger["readReplay"]>[0]) {
    return this.read(() => {
      const session = this.store.sessions[params.sessionId];
      return this.replay(session?.sessionKey === params.sessionKey ? session : undefined);
    });
  }

  readReplayBySessionId(params: Parameters<AcpEventLedger["readReplayBySessionId"]>[0]) {
    return this.read(() => this.replay(this.store.sessions[params.sessionId]));
  }

  readReplayBySessionKey(params: Parameters<AcpEventLedger["readReplayBySessionKey"]>[0]) {
    return this.read(() =>
      this.replay(
        Object.values(this.store.sessions)
          .filter((session) => session.sessionKey === params.sessionKey && session.complete)
          .toSorted((left, right) => right.updatedAt - left.updatedAt)[0],
      ),
    );
  }
}

export function createInMemoryAcpEventLedger(options: LedgerOptions = {}): AcpEventLedger {
  return new AcpEventLedgerService(options);
}

export function resolveDefaultAcpEventLedgerPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveStateDir(env), "acp", "event-ledger.json");
}

export function createFileAcpEventLedger(
  params: { filePath: string } & LedgerOptions,
): AcpEventLedger {
  return new AcpEventLedgerService(params, params.filePath);
}
