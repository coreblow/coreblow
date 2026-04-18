// Stub for fake-indexeddb/auto AND matrix-js-sdk — used by extensions/matrix
// In test environment, we provide minimal class stubs so that
// `class X extends MemoryStore` doesn't throw "extends undefined".

import { EventEmitter } from "node:events";

// ─── fake-indexeddb stubs ─────────────────────────────────────
// No actual IndexedDB needed in tests.

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
