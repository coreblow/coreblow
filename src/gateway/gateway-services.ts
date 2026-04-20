/**
 * CoreBlow — Gateway Services
 *
 * Singleton ServiceRegistry instance for the gateway runtime.
 * All Tier-2 services (those implementing GatewayService) are registered
 * here for coordinated lifecycle management (start/stop/health).
 *
 * Usage:
 *   import { getGatewayRegistry, registerInfraServices } from './gateway-services.js';
 *   registerInfraServices();         // call once at boot
 *   await getGatewayRegistry().startAll();  // start all in dependency order
 *   await getGatewayRegistry().stopAll();   // stop all in reverse order
 */

import { ServiceRegistry } from "./service-registry.js";

// Lazy imports to avoid circular dependency issues — these are resolved
// at registration time, not at module load time.

let _registry: ServiceRegistry | null = null;

/**
 * Get the singleton gateway ServiceRegistry.
 * Created lazily on first access.
 */
export function getGatewayRegistry(): ServiceRegistry {
  if (!_registry) {
    _registry = new ServiceRegistry();
  }
  return _registry;
}

/**
 * Register all Tier-2 infrastructure services with the gateway registry.
 * This should be called once during gateway boot, before startAll().
 *
 * Services are registered in dependency order (no cross-deps currently):
 * 1. ssh-tunnel, bonjour-discovery — network-level, no infra deps
 * 2. restart — process-level, no infra deps
 * 3. cron-scheduler — may schedule restart tasks
 * 4. update-runner — may trigger restart
 * 5. heartbeat — depends on config only
 * 6. outbound-delivery — depends on config only
 * 7. exec-approval-forwarder — depends on config only
 */
export async function registerInfraServices(): Promise<void> {
  const registry = getGatewayRegistry();

  // Import singletons lazily to avoid load-time circular deps
  const { getSshTunnelService } = await import("../infra/ssh-tunnel.js");
  const { getBonjourDiscoveryService } = await import("../infra/bonjour-discovery.js");
  const { getRestartService } = await import("../infra/restart.js");
  const { getCronSchedulerService } = await import("../infra/cron-scheduler.js");
  const { getUpdateRunnerService } = await import("../infra/update-runner.js");
  const { getHeartbeatRunnerService } = await import("../infra/heartbeat-runner.js");
  const { getOutboundDeliveryService } = await import("../infra/outbound/deliver.js");
  const { getExecApprovalForwarderService } = await import("../infra/exec-approval-forwarder.js");

  // Register in dependency order (none have cross-deps currently)
  registry.register("ssh-tunnel", getSshTunnelService());
  registry.register("bonjour-discovery", getBonjourDiscoveryService());
  registry.register("restart", getRestartService());
  registry.register("cron-scheduler", getCronSchedulerService());
  registry.register("update-runner", getUpdateRunnerService());
  registry.register("heartbeat", getHeartbeatRunnerService());
  registry.register("outbound-delivery", getOutboundDeliveryService());
  registry.register("exec-approval-forwarder", getExecApprovalForwarderService());
}

/**
 * Reset the gateway registry (test use only).
 */
export function __testing_resetGatewayRegistry(): void {
  if (process.env.NODE_ENV !== "test") return;
  _registry = null;
}
