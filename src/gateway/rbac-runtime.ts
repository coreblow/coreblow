/**
 * CoreBlow — Gateway RBAC Runtime Bridge
 *
 * Lazy-initializes PersistentRbacStore for authorizeGatewayMethod without
 * impacting CLI cold-start latency, and enforces fail-closed behavior with
 * redacted control-plane audit logging.
 */

import { formatControlPlaneActor, resolveControlPlaneActor } from "./control-plane-audit.js";
import { ErrorCodes, errorShape } from "./protocol/index.js";
import type { GatewayClient } from "./server-methods/types.js";
import { isLoopbackAddress } from "./net.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import {
  formatRedactedRbacAudit,
  PersistentRbacStore,
  type RbacEnforcementMode,
} from "../security/rbac-store.js";

const rbacLog = createSubsystemLogger("gateway/rbac");

export interface GatewayRbacRuntimeConfig {
  readonly mode: RbacEnforcementMode;
  readonly gatewayMode?: "local" | "remote";
  readonly dbPath?: string;
}

let runtimeMode: RbacEnforcementMode | null = null;
let runtimeGatewayMode: "local" | "remote" = "local";
let runtimeDbPath: string | undefined;
let cachedStore: PersistentRbacStore | null = null;
let storeInitError: string | null = null;

export function resolveRbacEnforcementMode(): RbacEnforcementMode {
  if (runtimeMode !== null) {
    return runtimeMode;
  }
  const raw = process.env.COREBLOW_RBAC_MODE?.trim().toLowerCase();
  if (raw === "enforced" || raw === "advisory" || raw === "off") {
    return raw;
  }
  return "off";
}

export function configureGatewayRbacRuntime(config: GatewayRbacRuntimeConfig): void {
  closeGatewayRbacRuntime();
  runtimeMode = config.mode;
  runtimeGatewayMode = config.gatewayMode ?? "local";
  runtimeDbPath = config.dbPath;
  storeInitError = null;
}

export function closeGatewayRbacRuntime(): void {
  if (cachedStore) {
    cachedStore.close();
    cachedStore = null;
  }
  storeInitError = null;
}

export function resetGatewayRbacRuntimeForTest(): void {
  closeGatewayRbacRuntime();
  runtimeMode = null;
  runtimeGatewayMode = "local";
  runtimeDbPath = undefined;
}

export function invalidateGatewayRbacCache(): void {
  cachedStore?.invalidateCache();
}

function getOrOpenStore(): PersistentRbacStore {
  if (cachedStore) {
    return cachedStore;
  }
  if (storeInitError) {
    throw new Error(storeInitError);
  }
  try {
    cachedStore = new PersistentRbacStore({
      dbPath: runtimeDbPath,
      gatewayMode: runtimeGatewayMode,
    });
    return cachedStore;
  } catch (err) {
    storeInitError = err instanceof Error ? err.message : String(err);
    throw err;
  }
}

export function resolvePrincipalIdForClient(client: GatewayClient | null): string {
  const actor = resolveControlPlaneActor(client);
  if (actor.deviceId !== "unknown-device") {
    return `device:${actor.deviceId}`;
  }
  return `client:${actor.actor}`;
}

export function authorizeGatewayRbacMethod(
  method: string,
  client: GatewayClient | null,
): ReturnType<typeof errorShape> | null {
  const mode = resolveRbacEnforcementMode();
  if (mode === "off") {
    return null;
  }

  const actor = resolveControlPlaneActor(client);
  const principalId = resolvePrincipalIdForClient(client);
  const actorSummary = formatControlPlaneActor(actor);

  let store: PersistentRbacStore;
  try {
    store = getOrOpenStore();
  } catch (err) {
    const detail = formatRedactedRbacAudit(err instanceof Error ? err.message : String(err));
    rbacLog.error(
      formatRedactedRbacAudit(
        `RBAC store unavailable method=${method} ${actorSummary} error=${detail}`,
      ),
    );
    if (mode === "enforced") {
      return errorShape(ErrorCodes.INVALID_REQUEST, `rbac denied: store unavailable`);
    }
    return null;
  }

  const isLocalClient =
    runtimeGatewayMode === "local" &&
    (actor.clientIp === "unknown-ip" || isLoopbackAddress(actor.clientIp));

  try {
    const decision = store.evaluateMethodAccess({
      principalId,
      method,
      isLocalBootstrapEligible: isLocalClient,
    });
    if (decision.allowed) {
      return null;
    }

    rbacLog.warn(
      formatRedactedRbacAudit(
        `RBAC ${mode === "enforced" ? "deny" : "advisory_deny"} method=${method} principal=${principalId} ${actorSummary} reason=${decision.reason}`,
      ),
    );

    if (mode === "enforced") {
      return errorShape(ErrorCodes.INVALID_REQUEST, `rbac denied: ${decision.reason}`);
    }
    return null;
  } catch (err) {
    const detail = formatRedactedRbacAudit(err instanceof Error ? err.message : String(err));
    rbacLog.error(
      formatRedactedRbacAudit(
        `RBAC evaluation error method=${method} principal=${principalId} ${actorSummary} error=${detail}`,
      ),
    );
    if (mode === "enforced") {
      return errorShape(ErrorCodes.INVALID_REQUEST, `rbac denied: evaluation error`);
    }
    return null;
  }
}
