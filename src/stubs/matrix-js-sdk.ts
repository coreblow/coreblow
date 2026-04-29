/**
 * Stub for matrix-js-sdk — provides empty exports so that vitest
 * contract tests can load the bundled channel entries without
 * requiring the full matrix-js-sdk implementation.
 */

// ── Enums / Constants ────────────────────────────────────────────
export const EventType = {} as Record<string, string>;
export const RoomEvent = {} as Record<string, string>;
export const ClientEvent = {} as Record<string, string>;
export const MatrixEventEvent = {} as Record<string, string>;
export const RoomMemberEvent = {} as Record<string, string>;
export const RoomStateEvent = {} as Record<string, string>;
export const MsgType = {} as Record<string, string>;
export const Preset = {} as Record<string, string>;
export const Visibility = {} as Record<string, string>;
export const VerificationMethod = {} as Record<string, string>;
export const Category = {} as Record<string, string>;
export const CryptoEvent = {} as Record<string, string>;

// ── Classes ──────────────────────────────────────────────────────
export class MatrixClient {
  [k: string]: unknown;
}
export class MatrixEvent {
  [k: string]: unknown;
}
export class Room {
  [k: string]: unknown;
}
export class RoomMember {
  [k: string]: unknown;
}
export class MemoryStore {
  [k: string]: unknown;
}
export class SyncAccumulator {
  [k: string]: unknown;
  constructor(..._args: unknown[]) {}
  getJSON(): unknown { return {}; }
  accumulate(_syncResponse: unknown): void {}
}

// ── Functions ────────────────────────────────────────────────────
export function createClient(..._args: unknown[]): MatrixClient {
  return new MatrixClient();
}
export function decodeRecoveryKey(_key: string): Uint8Array {
  return new Uint8Array();
}

// ── Logger ───────────────────────────────────────────────────────
export const logger = {
  info: (..._args: unknown[]) => {},
  warn: (..._args: unknown[]) => {},
  error: (..._args: unknown[]) => {},
  debug: (..._args: unknown[]) => {},
  trace: (..._args: unknown[]) => {},
  setLevel: (_level: unknown) => {},
};

// ── Type stubs ───────────────────────────────────────────────────
export type ISyncData = unknown;
export type IRooms = unknown;
export type ISyncResponse = unknown;
export type IStoredClientOpts = unknown;

// ── Default export ───────────────────────────────────────────────
export default {};
