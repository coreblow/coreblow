// Stub for fake-indexeddb/auto AND matrix-js-sdk — used by extensions/matrix
// In test environment, we provide minimal class stubs so that
// `class X extends MemoryStore` doesn't throw "extends undefined".

import { EventEmitter } from "node:events";

// ─── fake-indexeddb stubs ─────────────────────────────────────
// Provide a minimal in-memory IndexedDB implementation for tests
// that import "fake-indexeddb/auto".

class FakeIDBRequest {
  result: unknown = undefined;
  error: unknown = null;
  onsuccess: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onupgradeneeded: ((event: unknown) => void) | null = null;
}

class FakeIDBObjectStore {
  private data = new Map<string, unknown>();
  name: string;
  keyPath: string | null;

  constructor(name: string, keyPath?: string | null) {
    this.name = name;
    this.keyPath = keyPath ?? null;
  }

  put(value: unknown, key?: string) {
    const req = new FakeIDBRequest();
    const k = key ?? (this.keyPath && typeof value === "object" && value ? (value as Record<string, unknown>)[this.keyPath] as string : String(Math.random()));
    this.data.set(String(k), value);
    req.result = k;
    queueMicrotask(() => req.onsuccess?.({ target: req }));
    return req;
  }

  get(key: string) {
    const req = new FakeIDBRequest();
    req.result = this.data.get(String(key));
    queueMicrotask(() => req.onsuccess?.({ target: req }));
    return req;
  }

  getAll() {
    const req = new FakeIDBRequest();
    req.result = Array.from(this.data.values());
    queueMicrotask(() => req.onsuccess?.({ target: req }));
    return req;
  }

  delete(key: string) {
    const req = new FakeIDBRequest();
    this.data.delete(String(key));
    queueMicrotask(() => req.onsuccess?.({ target: req }));
    return req;
  }

  clear() {
    const req = new FakeIDBRequest();
    this.data.clear();
    queueMicrotask(() => req.onsuccess?.({ target: req }));
    return req;
  }

  createIndex() { return {}; }
}

class FakeIDBTransaction {
  private db: FakeIDBDatabase;
  oncomplete: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onabort: ((event: unknown) => void) | null = null;

  constructor(db: FakeIDBDatabase) {
    this.db = db;
    queueMicrotask(() => this.oncomplete?.({ target: this }));
  }

  objectStore(name: string) {
    return this.db._getStore(name);
  }
}

class FakeIDBDatabase {
  name: string;
  version: number;
  objectStoreNames: string[] = [];
  private stores = new Map<string, FakeIDBObjectStore>();
  onclose: ((event: unknown) => void) | null = null;

  constructor(name: string, version: number) {
    this.name = name;
    this.version = version;
  }

  createObjectStore(name: string, opts?: { keyPath?: string }) {
    const store = new FakeIDBObjectStore(name, opts?.keyPath);
    this.stores.set(name, store);
    this.objectStoreNames.push(name);
    return store;
  }

  transaction(storeNames: string | string[], _mode?: string) {
    return new FakeIDBTransaction(this);
  }

  _getStore(name: string) {
    if (!this.stores.has(name)) {
      this.createObjectStore(name);
    }
    return this.stores.get(name)!;
  }

  close() {
    this.onclose?.({ target: this });
  }
}

const _databases = new Map<string, FakeIDBDatabase>();

const fakeIndexedDB = {
  open(name: string, version?: number) {
    const req = new FakeIDBRequest();
    let db = _databases.get(name);
    const isNew = !db;
    if (!db || (version && version > db.version)) {
      db = new FakeIDBDatabase(name, version ?? 1);
      _databases.set(name, db);
    }
    req.result = db;
    queueMicrotask(() => {
      if (isNew && version) {
        req.onupgradeneeded?.({ target: req, oldVersion: 0, newVersion: version });
      }
      req.onsuccess?.({ target: req });
    });
    return req;
  },

  deleteDatabase(name: string) {
    const req = new FakeIDBRequest();
    _databases.delete(name);
    queueMicrotask(() => req.onsuccess?.({ target: req }));
    return req;
  },

  databases() {
    return Promise.resolve(
      Array.from(_databases.entries()).map(([name, db]) => ({ name, version: db.version }))
    );
  },
};

// Install globally so tests that use `indexedDB` directly can find it.
if (typeof globalThis.indexedDB === "undefined") {
  (globalThis as Record<string, unknown>).indexedDB = fakeIndexedDB;
}

// ─── matrix-js-sdk stubs ──────────────────────────────────────
// Enough to prevent "Class extends value undefined" errors when
// extensions/matrix/src/matrix/client/file-sync-store.ts imports
// MemoryStore from matrix-js-sdk/lib/matrix.js.

export class MemoryStore {
  storeGroup() {}
  getGroup() { return null; }
  getGroups() { return []; }
  setSyncData() {}
  getSyncToken() { return null; }
  setSyncToken() {}
  startup() { return Promise.resolve(); }
  getSavedSync() { return Promise.resolve(null); }
  deleteAllData() { return Promise.resolve(); }
  getOutOfBandMembers() { return Promise.resolve(null); }
  setOutOfBandMembers() { return Promise.resolve(); }
  clearOutOfBandMembers() { return Promise.resolve(); }
  getClientOptions() { return Promise.resolve(undefined); }
  storeClientOptions() { return Promise.resolve(); }
}

export class SyncAccumulator {
  accumulate() {}
  getJSON() { return { nextBatch: "", roomsData: {}, accountData: [] }; }
}

export class MatrixClient extends EventEmitter {
  credentials = { userId: "" };
  store = new MemoryStore();
  startClient() { return Promise.resolve(); }
  stopClient() {}
  login() { return Promise.resolve({ access_token: "stub" }); }
  logout() { return Promise.resolve(); }
  getRoom() { return null; }
  getRooms() { return []; }
  sendMessage() { return Promise.resolve({ event_id: "stub" }); }
  sendEvent() { return Promise.resolve({ event_id: "stub" }); }
  joinRoom() { return Promise.resolve({ roomId: "stub" }); }
  leave() { return Promise.resolve(); }
  on() { return this; }
  off() { return this; }
  removeAllListeners() { return this; }
}

export function createClient(_opts: any): MatrixClient {
  return new MatrixClient();
}

// matrix-js-sdk enum stubs
export const ClientEvent = {
  Sync: "sync",
  Room: "Room",
  RoomMember: "RoomMember.membership",
  AccountData: "accountData",
  Event: "event",
  ToDeviceEvent: "toDeviceEvent",
};

export const MatrixEventEvent = {
  Decrypted: "Event.decrypted",
};

export const Preset = {
  PrivateChat: "private_chat",
  TrustedPrivateChat: "trusted_private_chat",
  PublicChat: "public_chat",
};

export const Category = {
  Invite: "invite",
  Leave: "leave",
  Join: "join",
  Knock: "knock",
};

// Default export for `import "fake-indexeddb/auto"` side-effect usage
export default {};
