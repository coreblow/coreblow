import type { RuntimeEnv } from "../../runtime.js";
import { t } from "../../infra/i18n/index.js";
import { writeRuntimeJson } from "../../runtime.js";
import { colorize, theme } from "../../terminal/theme.js";
import { serializeGatewayDiscoveryBeacon } from "./discovery.js";
import {
  isProbeReachable,
  isScopeLimitedProbeFailure,
  renderProbeSummaryLine,
  renderTargetHeader,
} from "./helpers.js";
import type { GatewayStatusProbedTarget } from "./probe-run.js";

export type GatewayStatusWarning = {
  code: string;
  message: string;
  targetIds?: string[];
};

export function pickPrimaryProbedTarget(probed: GatewayStatusProbedTarget[]) {
  const reachable = probed.filter((entry) => isProbeReachable(entry.probe));
  return (
    reachable.find((entry) => entry.target.kind === "explicit") ??
    reachable.find((entry) => entry.target.kind === "sshTunnel") ??
    reachable.find((entry) => entry.target.kind === "configRemote") ??
    reachable.find((entry) => entry.target.kind === "localLoopback") ??
    null
  );
}

export function buildGatewayStatusWarnings(params: {
  probed: GatewayStatusProbedTarget[];
  sshTarget: string | null;
  sshTunnelStarted: boolean;
  sshTunnelError: string | null;
}): GatewayStatusWarning[] {
  const reachable = params.probed.filter((entry) => isProbeReachable(entry.probe));
  const degradedScopeLimited = params.probed.filter((entry) =>
    isScopeLimitedProbeFailure(entry.probe),
  );
  const warnings: GatewayStatusWarning[] = [];
  if (params.sshTarget && !params.sshTunnelStarted) {
    warnings.push({
      code: "ssh_tunnel_failed",
      message: params.sshTunnelError
        ? t("gateway_status.ssh_tunnel_failed", { error: String(params.sshTunnelError) })
        : t("gateway_status.ssh_tunnel_failed_fallback"),
    });
  }
  if (reachable.length > 1) {
    warnings.push({
      code: "multiple_gateways",
      message: t("gateway_status.multiple_gateways"),
      targetIds: reachable.map((entry) => entry.target.id),
    });
  }
  for (const result of params.probed) {
    if (result.authDiagnostics.length === 0 || isProbeReachable(result.probe)) {
      continue;
    }
    for (const diagnostic of result.authDiagnostics) {
      warnings.push({
        code: "auth_secretref_unresolved",
        message: diagnostic,
        targetIds: [result.target.id],
      });
    }
  }
  for (const result of degradedScopeLimited) {
    warnings.push({
      code: "probe_scope_limited",
      message: t("gateway_status.probe_scope_limited"),
      targetIds: [result.target.id],
    });
  }
  return warnings;
}

export function writeGatewayStatusJson(params: {
  runtime: RuntimeEnv;
  startedAt: number;
  overallTimeoutMs: number;
  discoveryTimeoutMs: number;
  network: ReturnType<typeof import("./helpers.js").buildNetworkHints>;
  discovery: Parameters<typeof serializeGatewayDiscoveryBeacon>[0][];
  probed: GatewayStatusProbedTarget[];
  warnings: GatewayStatusWarning[];
  primaryTargetId: string | null;
}) {
  const reachable = params.probed.filter((entry) => isProbeReachable(entry.probe));
  const degraded = params.probed.some((entry) => isScopeLimitedProbeFailure(entry.probe));
  writeRuntimeJson(params.runtime, {
    ok: reachable.length > 0,
    degraded,
    ts: Date.now(),
    durationMs: Date.now() - params.startedAt,
    timeoutMs: params.overallTimeoutMs,
    primaryTargetId: params.primaryTargetId,
    warnings: params.warnings,
    network: params.network,
    discovery: {
      timeoutMs: params.discoveryTimeoutMs,
      count: params.discovery.length,
      beacons: params.discovery.map((beacon) => serializeGatewayDiscoveryBeacon(beacon)),
    },
    targets: params.probed.map((entry) => ({
      id: entry.target.id,
      kind: entry.target.kind,
      url: entry.target.url,
      active: entry.target.active,
      tunnel: entry.target.tunnel ?? null,
      connect: {
        ok: isProbeReachable(entry.probe),
        rpcOk: entry.probe.ok,
        scopeLimited: isScopeLimitedProbeFailure(entry.probe),
        latencyMs: entry.probe.connectLatencyMs,
        error: entry.probe.error,
        close: entry.probe.close,
      },
      self: entry.self,
      config: entry.configSummary,
      health: entry.probe.health,
      summary: entry.probe.status,
      presence: entry.probe.presence,
    })),
  });
  if (reachable.length === 0) {
    params.runtime.exit(1);
  }
}

export function writeGatewayStatusText(params: {
  runtime: RuntimeEnv;
  rich: boolean;
  overallTimeoutMs: number;
  wideAreaDomain?: string | null;
  discovery: Parameters<typeof serializeGatewayDiscoveryBeacon>[0][];
  probed: GatewayStatusProbedTarget[];
  warnings: GatewayStatusWarning[];
}) {
  const reachable = params.probed.filter((entry) => isProbeReachable(entry.probe));
  const ok = reachable.length > 0;
  params.runtime.log(colorize(params.rich, theme.heading, t("gateway_status.title")));
  params.runtime.log(
    ok
      ? `${colorize(params.rich, theme.success, t("gateway_status.reachable"))}: ${t("common.yes")}`
      : `${colorize(params.rich, theme.error, t("gateway_status.reachable"))}: ${t("common.no")}`,
  );
  params.runtime.log(
    colorize(
      params.rich,
      theme.muted,
      t("gateway_status.probe_budget", { timeout: String(params.overallTimeoutMs) }),
    ),
  );

  if (params.warnings.length > 0) {
    params.runtime.log("");
    params.runtime.log(colorize(params.rich, theme.warn, t("common.warning")));
    for (const warning of params.warnings) {
      params.runtime.log(`- ${warning.message}`);
    }
  }

  params.runtime.log("");
  params.runtime.log(colorize(params.rich, theme.heading, t("gateway_status.discovery_local")));
  const discoveryDomains = params.wideAreaDomain ? `local. + ${params.wideAreaDomain}` : "local.";
  params.runtime.log(
    params.discovery.length > 0
      ? t("gateway_status.discovery_found", {
          count: String(params.discovery.length),
          domains: discoveryDomains,
        })
      : t("gateway_status.discovery_found", { count: "0", domains: discoveryDomains }),
  );
  if (params.discovery.length === 0) {
    params.runtime.log(
      colorize(
        params.rich,
        theme.muted,
        t("gateway_status.discovery_tip"),
      ),
    );
  }

  params.runtime.log("");
  params.runtime.log(colorize(params.rich, theme.heading, t("gateway_status.targets")));
  for (const result of params.probed) {
    params.runtime.log(renderTargetHeader(result.target, params.rich));
    params.runtime.log(`  ${renderProbeSummaryLine(result.probe, params.rich)}`);
    if (result.target.tunnel?.kind === "ssh") {
      params.runtime.log(
        `  ${colorize(params.rich, theme.muted, "ssh")}: ${colorize(params.rich, theme.command, result.target.tunnel.target)}`,
      );
    }
    if (result.probe.ok && result.self) {
      const host = result.self.host ?? t("common.unknown");
      const ip = result.self.ip ? ` (${result.self.ip})` : "";
      const platform = result.self.platform ? ` · ${result.self.platform}` : "";
      const version = result.self.version ? ` · ${t("status.app_version", { version: result.self.version })}` : "";
      params.runtime.log(
        `  ${colorize(params.rich, theme.info, t("status.items.gateway"))}: ${host}${ip}${platform}${version}`,
      );
    }
    if (result.configSummary) {
      const wideArea =
        result.configSummary.discovery.wideAreaEnabled === true
          ? t("common.enabled")
          : result.configSummary.discovery.wideAreaEnabled === false
            ? t("common.disabled")
            : t("common.unknown");
      params.runtime.log(
        `  ${colorize(params.rich, theme.info, t("gateway_status.wide_area_discovery"))}: ${wideArea}`,
      );
    }
    params.runtime.log("");
  }

  if (!ok) {
    params.runtime.exit(1);
  }
}
