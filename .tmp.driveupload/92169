import { normalizeDeviceMetadataForAuth } from "./device-metadata-normalization.js";
export { normalizeDeviceMetadataForAuth };

export type DeviceAuthPayloadParams = {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;
  nonce: string;
};

export type DeviceAuthPayloadV3Params = DeviceAuthPayloadParams & {
  platform?: string | null;
  deviceFamily?: string | null;
};

export function buildDeviceAuthPayload(params: DeviceAuthPayloadParams): string {
  const scopes = params.scopes.join(",");
  const token = params.token ?? "";
  return [
    "v2",
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
    params.nonce,
  ].join("|");
}

export function buildDeviceAuthPayloadV3(params: DeviceAuthPayloadV3Params): string {
  const scopes = params.scopes.join(",");
  const token = params.token ?? "";
  const platform = normalizeDeviceMetadataForAuth(params.platform);
  const deviceFamily = normalizeDeviceMetadataForAuth(params.deviceFamily);
  return [
    "v3",
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
    params.nonce,
    platform,
    deviceFamily,
  ].join("|");
}

// Backward-compat helpers for existing CoreBlow tests
import { randomUUID } from "node:crypto";

export function authenticateDevice(
  storedTokens: string[] | undefined,
  providedToken: string | undefined,
): { allowed: boolean; reason?: string } {
  if (!providedToken) {
    return { allowed: false, reason: "missing device token" };
  }
  if (!storedTokens || storedTokens.length === 0) {
    return { allowed: false, reason: "device not registered" };
  }
  if (storedTokens.includes(providedToken)) {
    return { allowed: true };
  }
  return { allowed: false, reason: "invalid device token" };
}

export function generateDeviceToken(): string {
  return `dev_${randomUUID().replace(/-/g, "")}`;
}
