import { withProgress } from "../cli/progress.js";
import type { HeartbeatEventPayload } from "../infra/heartbeat-events.js";
import { t } from "../infra/i18n/index.js";
import { normalizeUpdateChannel, resolveUpdateChannelDisplay } from "../infra/update-channels.js";
import type { Tone } from "../plugin-sdk/memory-core-host-status.js";
import { type RuntimeEnv, writeRuntimeJson } from "../runtime.js";
import type { HealthSummary } from "./health.js";
import { getDaemonStatusSummary, getNodeDaemonStatusSummary } from "./status.daemon.js";

let providerUsagePromise: Promise<typeof import("../infra/provider-usage.js")> | undefined;
let securityAuditModulePromise: Promise<typeof import("../security/audit.runtime.js")> | undefined;
let gatewayCallModulePromise: Promise<typeof import("../gateway/call.js")> | undefined;
let statusScanModulePromise: Promise<typeof import("./status.scan.js")> | undefined;
let statusScanFastJsonModulePromise:
  | Promise<typeof import("./status.scan.fast-json.js")>
  | undefined;
let statusAllModulePromise: Promise<typeof import("./status-all.js")> | undefined;
let statusCommandTextRuntimePromise:
  | Promise<typeof import("./status.command.text-runtime.js")>
  | undefined;

function loadProviderUsage() {
  providerUsagePromise ??= import("../infra/provider-usage.js");
  return providerUsagePromise;
}

function loadSecurityAuditModule() {
  securityAuditModulePromise ??= import("../security/audit.runtime.js");
  return securityAuditModulePromise;
}

function loadGatewayCallModule() {
  gatewayCallModulePromise ??= import("../gateway/call.js");
  return gatewayCallModulePromise;
}

function loadStatusScanModule() {
  statusScanModulePromise ??= import("./status.scan.js");
  return statusScanModulePromise;
}

function loadStatusScanFastJsonModule() {
  statusScanFastJsonModulePromise ??= import("./status.scan.fast-json.js");
  return statusScanFastJsonModulePromise;
}

function loadStatusAllModule() {
  statusAllModulePromise ??= import("./status-all.js");
  return statusAllModulePromise;
}

function loadStatusCommandTextRuntime() {
  statusCommandTextRuntimePromise ??= import("./status.command.text-runtime.js");
  return statusCommandTextRuntimePromise;
}

function resolvePairingRecoveryContext(params: {
  error?: string | null;
  closeReason?: string | null;
}): { requestId: string | null } | null {
  const sanitizeRequestId = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    // Keep CLI guidance injection-safe: allow only compact id characters.
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(trimmed)) {
      return null;
    }
    return trimmed;
  };
  const source = [params.error, params.closeReason]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .join(" ");
  if (!source || !/pairing required/i.test(source)) {
    return null;
  }
  const requestIdMatch = source.match(/requestId:\s*([^\s)]+)/i);
  const requestId =
    requestIdMatch && requestIdMatch[1] ? sanitizeRequestId(requestIdMatch[1]) : null;
  return { requestId: requestId || null };
}

export async function statusCommand(
  opts: {
    json?: boolean;
    deep?: boolean;
    usage?: boolean;
    timeoutMs?: number;
    verbose?: boolean;
    all?: boolean;
  },
  runtime: RuntimeEnv,
) {
  if (opts.all && !opts.json) {
    await loadStatusAllModule().then(({ statusAllCommand }) =>
      statusAllCommand(runtime, { timeoutMs: opts.timeoutMs }),
    );
    return;
  }

  const scan = opts.json
    ? await loadStatusScanFastJsonModule().then(({ scanStatusJsonFast }) =>
        scanStatusJsonFast({ timeoutMs: opts.timeoutMs, all: opts.all }, runtime),
      )
    : await loadStatusScanModule().then(({ scanStatus }) =>
        scanStatus({ json: false, timeoutMs: opts.timeoutMs, all: opts.all }, runtime),
      );
  const runSecurityAudit = async () =>
    await loadSecurityAuditModule().then(({ runSecurityAudit }) =>
      runSecurityAudit({
        config: scan.cfg,
        sourceConfig: scan.sourceConfig,
        deep: false,
        includeFilesystem: true,
        includeChannelSecurity: true,
      }),
    );
  const securityAudit = opts.json
    ? await runSecurityAudit()
    : await withProgress(
        {
          label: t("status.progress.security_audit"),
          indeterminate: true,
          enabled: true,
        },
        async () => await runSecurityAudit(),
      );
  const {
    cfg,
    osSummary,
    tailscaleMode,
    tailscaleDns,
    tailscaleHttpsUrl,
    update,
    gatewayConnection,
    remoteUrlMissing,
    gatewayMode,
    gatewayProbeAuth,
    gatewayProbeAuthWarning,
    gatewayProbe,
    gatewayReachable,
    gatewaySelf,
    channelIssues,
    agentStatus,
    channels,
    summary,
    secretDiagnostics,
    memory,
    memoryPlugin,
    pluginCompatibility,
  } = scan;

  const usage = opts.usage
    ? await withProgress(
        {
          label: t("status.progress.usage_snapshot"),
          indeterminate: true,
          enabled: opts.json !== true,
        },
        async () => {
          const { loadProviderUsageSummary } = await loadProviderUsage();
          return await loadProviderUsageSummary({ timeoutMs: opts.timeoutMs });
        },
      )
    : undefined;
  const health: HealthSummary | undefined = opts.deep
    ? await withProgress(
        {
          label: t("health.checking_gateway"),
          indeterminate: true,
          enabled: opts.json !== true,
        },
        async () => {
          const { callGateway } = await loadGatewayCallModule();
          return await callGateway<HealthSummary>({
            method: "health",
            params: { probe: true },
            timeoutMs: opts.timeoutMs,
            config: scan.cfg,
          });
        },
      )
    : undefined;
  const lastHeartbeat =
    opts.deep && gatewayReachable
      ? await loadGatewayCallModule()
          .then(({ callGateway }) =>
            callGateway<HeartbeatEventPayload | null>({
              method: "last-heartbeat",
              params: {},
              timeoutMs: opts.timeoutMs,
              config: scan.cfg,
            }),
          )
          .catch(() => null)
      : null;

  const configChannel = normalizeUpdateChannel(cfg.update?.channel);
  const channelInfo = resolveUpdateChannelDisplay({
    configChannel,
    installKind: update.installKind,
    gitTag: update.git?.tag ?? null,
    gitBranch: update.git?.branch ?? null,
  });

  if (opts.json) {
    const [daemon, nodeDaemon] = await Promise.all([
      getDaemonStatusSummary(),
      getNodeDaemonStatusSummary(),
    ]);
    writeRuntimeJson(runtime, {
      ...summary,
      os: osSummary,
      update,
      updateChannel: channelInfo.channel,
      updateChannelSource: channelInfo.source,
      memory,
      memoryPlugin,
      gateway: {
        mode: gatewayMode,
        url: gatewayConnection.url,
        urlSource: gatewayConnection.urlSource,
        misconfigured: remoteUrlMissing,
        reachable: gatewayReachable,
        connectLatencyMs: gatewayProbe?.connectLatencyMs ?? null,
        self: gatewaySelf,
        error: gatewayProbe?.error ?? null,
        authWarning: gatewayProbeAuthWarning ?? null,
      },
      gatewayService: daemon,
      nodeService: nodeDaemon,
      agents: agentStatus,
      securityAudit,
      secretDiagnostics,
      pluginCompatibility: {
        count: pluginCompatibility.length,
        warnings: pluginCompatibility,
      },
      ...(health || usage || lastHeartbeat ? { health, usage, lastHeartbeat } : {}),
    });
    return;
  }

  const rich = true;
  const {
    formatCliCommand,
    formatDuration,
    formatGatewayAuthUsed,
    formatGitInstallLabel,
    formatHealthChannelLines,
    formatKTokens,
    formatPluginCompatibilityNotice,
    formatTimeAgo,
    formatTokensCompact,
    formatUpdateAvailableHint,
    formatUpdateOneLiner,
    getTerminalTableWidth,
    groupChannelIssuesByChannel,
    info,
    renderTable,
    resolveControlUiLinks,
    resolveGatewayPort,
    resolveMemoryCacheSummary,
    resolveMemoryFtsState,
    resolveMemoryVectorState,
    resolveUpdateAvailability,
    shortenText,
    summarizePluginCompatibility,
    theme,
  } = await loadStatusCommandTextRuntime();
  const muted = (value: string) => (rich ? theme.muted(value) : value);
  const ok = (value: string) => (rich ? theme.success(value) : value);
  const warn = (value: string) => (rich ? theme.warn(value) : value);

  if (opts.verbose) {
    const { buildGatewayConnectionDetails } = await loadGatewayCallModule();
    const details = buildGatewayConnectionDetails({ config: scan.cfg });
    runtime.log(info(t("health.gateway_connection")));
    for (const line of details.message.split("\n")) {
      runtime.log(`  ${line}`);
    }
    runtime.log("");
  }

  const tableWidth = getTerminalTableWidth();

  if (secretDiagnostics.length > 0) {
    runtime.log(theme.warn(t("status.credential_diagnostics")));
    for (const entry of secretDiagnostics) {
      runtime.log(`- ${entry}`);
    }
    runtime.log("");
  }

  const dashboard =
    (cfg.gateway?.controlUi?.enabled ?? true)
      ? resolveControlUiLinks({
          port: resolveGatewayPort(cfg),
          bind: cfg.gateway?.bind,
          customBindHost: cfg.gateway?.customBindHost,
          basePath: cfg.gateway?.controlUi?.basePath,
        }).httpUrl
      : t("common.disabled");

  const gatewayValue = (() => {
    const target = remoteUrlMissing
      ? `fallback ${gatewayConnection.url}`
      : `${gatewayConnection.url}${gatewayConnection.urlSource ? ` (${gatewayConnection.urlSource})` : ""}`;
    const reach = remoteUrlMissing
      ? warn("misconfigured (remote.url missing)")
      : gatewayReachable
        ? ok(t("status.gateway_reachable_latency", { latency: formatDuration(gatewayProbe?.connectLatencyMs) }))
        : warn(
            gatewayProbe?.error
              ? t("status.gateway_unreachable_error", { error: gatewayProbe.error })
              : t("status.gateway_unreachable"),
          );
    const auth =
      gatewayReachable && !remoteUrlMissing
        ? ` · ${t("status.auth", { value: formatGatewayAuthUsed(gatewayProbeAuth) })}`
        : "";
    const self =
      gatewaySelf?.host || gatewaySelf?.version || gatewaySelf?.platform
        ? [
            gatewaySelf?.host ? gatewaySelf.host : null,
            gatewaySelf?.ip ? `(${gatewaySelf.ip})` : null,
            gatewaySelf?.version ? t("status.app_version", { version: gatewaySelf.version }) : null,
            gatewaySelf?.platform ? gatewaySelf.platform : null,
          ]
            .filter(Boolean)
            .join(" ")
        : null;
    const suffix = self ? ` · ${self}` : "";
    return `${gatewayMode} · ${target} · ${reach}${auth}${suffix}`;
  })();
  const pairingRecovery = resolvePairingRecoveryContext({
    error: gatewayProbe?.error ?? null,
    closeReason: gatewayProbe?.close?.reason ?? null,
  });

  const agentsValue = (() => {
    const pending =
      agentStatus.bootstrapPendingCount > 0
      ? t("status.bootstrap_files_present", {
          count: String(agentStatus.bootstrapPendingCount),
          plural: agentStatus.bootstrapPendingCount === 1 ? "" : "s",
        })
      : t("status.no_bootstrap_files");
    const def = agentStatus.agents.find((a) => a.id === agentStatus.defaultId);
    const defActive =
      def?.lastActiveAgeMs != null ? formatTimeAgo(def.lastActiveAgeMs) : t("common.unknown");
    const defSuffix = def
      ? ` · ${t("status.default_agent_active", { id: def.id, age: defActive })}`
      : "";
    return `${agentStatus.agents.length} · ${pending} · ${t("status.sessions_count", {
      count: String(agentStatus.totalSessions),
    })}${defSuffix}`;
  })();

  const [daemon, nodeDaemon] = await Promise.all([
    getDaemonStatusSummary(),
    getNodeDaemonStatusSummary(),
  ]);
  const daemonValue = (() => {
    if (daemon.installed === false) {
      return t("status.service_not_installed", { label: daemon.label });
    }
    const installedPrefix = daemon.managedByCoreBlow ? `${t("common.installed")} · ` : "";
    return `${daemon.label} ${installedPrefix}${daemon.loadedText}${daemon.runtimeShort ? ` · ${daemon.runtimeShort}` : ""}`;
  })();
  const nodeDaemonValue = (() => {
    if (nodeDaemon.installed === false) {
      return t("status.service_not_installed", { label: nodeDaemon.label });
    }
    const installedPrefix = nodeDaemon.managedByCoreBlow ? `${t("common.installed")} · ` : "";
    return `${nodeDaemon.label} ${installedPrefix}${nodeDaemon.loadedText}${nodeDaemon.runtimeShort ? ` · ${nodeDaemon.runtimeShort}` : ""}`;
  })();

  const defaults = summary.sessions.defaults;
  const defaultCtx = defaults.contextTokens
    ? ` (${formatKTokens(defaults.contextTokens)} ctx)`
    : "";
  const eventsValue =
    summary.queuedSystemEvents.length > 0
      ? t("status.events_queued", { count: String(summary.queuedSystemEvents.length) })
      : t("common.none");

  const probesValue = health ? ok(t("common.enabled")) : muted(t("status.probes_skipped"));

  const heartbeatValue = (() => {
    const parts = summary.heartbeat.agents
      .map((agent) => {
        if (!agent.enabled || !agent.everyMs) {
          return `${t("common.disabled")} (${agent.agentId})`;
        }
        const everyLabel = agent.every;
        return `${everyLabel} (${agent.agentId})`;
      })
      .filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : t("common.disabled");
  })();
  const lastHeartbeatValue = (() => {
    if (!opts.deep) {
      return null;
    }
    if (!gatewayReachable) {
      return warn(t("common.unavailable"));
    }
    if (!lastHeartbeat) {
      return muted(t("common.none"));
    }
    const age = formatTimeAgo(Date.now() - lastHeartbeat.ts);
    const channel = lastHeartbeat.channel ?? t("common.unknown");
    const accountLabel = lastHeartbeat.accountId
      ? t("status.account", { id: lastHeartbeat.accountId })
      : null;
    return [lastHeartbeat.status, t("common.ago", { age }), channel, accountLabel]
      .filter(Boolean)
      .join(" · ");
  })();

  const storeLabel =
    summary.sessions.paths.length > 1
      ? `${summary.sessions.paths.length} stores`
      : (summary.sessions.paths[0] ?? t("common.unknown"));

  const memoryValue = (() => {
    if (!memoryPlugin.enabled) {
      const suffix = memoryPlugin.reason ? ` (${memoryPlugin.reason})` : "";
      return muted(`${t("common.disabled")}${suffix}`);
    }
    if (!memory) {
      const slot = memoryPlugin.slot
        ? t("status.plugin_slot", { slot: memoryPlugin.slot })
        : t("status.plugin");
      return muted(`${t("common.enabled")} (${slot}) · ${t("common.unavailable")}`);
    }
    const parts: string[] = [];
    const dirtySuffix = memory.dirty ? ` · ${warn("dirty")}` : "";
    parts.push(
      t("status.memory_files_chunks", {
        files: String(memory.files),
        chunks: String(memory.chunks),
      }) + dirtySuffix,
    );
    if (memory.sources?.length) {
      parts.push(t("status.sources", { sources: memory.sources.join(", ") }));
    }
    if (memoryPlugin.slot) {
      parts.push(t("status.plugin_slot", { slot: memoryPlugin.slot }));
    }
    const colorByTone = (tone: Tone, text: string) =>
      tone === "ok" ? ok(text) : tone === "warn" ? warn(text) : muted(text);
    const vector = memory.vector;
    if (vector) {
      const state = resolveMemoryVectorState(vector);
      const label =
        state.state === "disabled"
          ? t("status.vector_off")
          : t("status.vector_state", { state: state.state });
      parts.push(colorByTone(state.tone, label));
    }
    const fts = memory.fts;
    if (fts) {
      const state = resolveMemoryFtsState(fts);
      const label =
        state.state === "disabled"
          ? t("status.fts_off")
          : t("status.fts_state", { state: state.state });
      parts.push(colorByTone(state.tone, label));
    }
    const cache = memory.cache;
    if (cache) {
      const summary = resolveMemoryCacheSummary(cache);
      parts.push(colorByTone(summary.tone, summary.text));
    }
    return parts.join(" · ");
  })();

  const updateAvailability = resolveUpdateAvailability(update);
  const updateLine = formatUpdateOneLiner(update).replace(/^Update:\s*/i, "");
  const channelLabel = channelInfo.label;
  const gitLabel = formatGitInstallLabel(update);
  const pluginCompatibilitySummary = summarizePluginCompatibility(pluginCompatibility);
  const pluginCompatibilityValue =
    pluginCompatibilitySummary.noticeCount === 0
      ? ok(t("common.none"))
      : warn(
          t("status.plugin_compatibility_summary", {
            notices: String(pluginCompatibilitySummary.noticeCount),
            noticePlural: pluginCompatibilitySummary.noticeCount === 1 ? "" : "s",
            plugins: String(pluginCompatibilitySummary.pluginCount),
            pluginPlural: pluginCompatibilitySummary.pluginCount === 1 ? "" : "s",
          }),
        );

  const overviewRows = [
    { Item: t("status.items.dashboard"), Value: dashboard },
    { Item: "OS", Value: `${osSummary.label} · node ${process.versions.node}` },
    {
      Item: "Tailscale",
      Value:
        tailscaleMode === "off"
          ? muted("off")
          : tailscaleDns && tailscaleHttpsUrl
            ? `${tailscaleMode} · ${tailscaleDns} · ${tailscaleHttpsUrl}`
            : warn(`${tailscaleMode} · ${t("status.magicdns_unknown")}`),
    },
    { Item: t("status.items.channel"), Value: channelLabel },
    ...(gitLabel ? [{ Item: t("status.items.git"), Value: gitLabel }] : []),
    {
      Item: t("status.items.update"),
      Value: updateAvailability.available ? warn(`available · ${updateLine}`) : updateLine,
    },
    { Item: t("status.items.gateway"), Value: gatewayValue },
    ...(gatewayProbeAuthWarning
      ? [{ Item: t("status.items.gateway_auth_warning"), Value: warn(gatewayProbeAuthWarning) }]
      : []),
    { Item: t("status.items.gateway_service"), Value: daemonValue },
    { Item: t("status.items.node_service"), Value: nodeDaemonValue },
    { Item: t("status.items.agents"), Value: agentsValue },
    { Item: t("status.items.memory"), Value: memoryValue },
    { Item: t("status.items.plugin_compatibility"), Value: pluginCompatibilityValue },
    { Item: t("status.items.probes"), Value: probesValue },
    { Item: t("status.items.events"), Value: eventsValue },
    { Item: t("status.items.heartbeat"), Value: heartbeatValue },
    ...(lastHeartbeatValue ? [{ Item: t("status.items.last_heartbeat"), Value: lastHeartbeatValue }] : []),
    {
      Item: t("status.items.sessions"),
      Value: t("status.sessions_overview", {
        count: String(summary.sessions.count),
        model: defaults.model ?? t("common.unknown"),
        context: defaultCtx,
        store: storeLabel,
      }),
    },
  ];

  runtime.log(theme.heading(t("status.title")));
  runtime.log("");
  runtime.log(theme.heading(t("status.sections.overview")));
  runtime.log(
    renderTable({
      width: tableWidth,
      columns: [
        { key: "Item", header: t("status.table.item"), minWidth: 12 },
        { key: "Value", header: t("status.table.value"), flex: true, minWidth: 32 },
      ],
      rows: overviewRows,
    }).trimEnd(),
  );

  if (pluginCompatibility.length > 0) {
    runtime.log("");
    runtime.log(theme.heading(t("status.sections.plugin_compatibility")));
    for (const notice of pluginCompatibility.slice(0, 8)) {
      const label = notice.severity === "warn" ? theme.warn("WARN") : theme.muted("INFO");
      runtime.log(`  ${label} ${formatPluginCompatibilityNotice(notice)}`);
    }
    if (pluginCompatibility.length > 8) {
      runtime.log(theme.muted(t("common.more_count", { count: String(pluginCompatibility.length - 8) })));
    }
  }

  if (pairingRecovery) {
    runtime.log("");
    runtime.log(theme.warn(t("status.pairing_required")));
    if (pairingRecovery.requestId) {
      runtime.log(
        theme.muted(
          t("status.recovery", {
            command: formatCliCommand(`coreblow devices approve ${pairingRecovery.requestId}`),
          }),
        ),
      );
    }
    runtime.log(
      theme.muted(
        t("status.fallback", { command: formatCliCommand("coreblow devices approve --latest") }),
      ),
    );
    runtime.log(
      theme.muted(t("status.inspect", { command: formatCliCommand("coreblow devices list") })),
    );
  }

  runtime.log("");
  runtime.log(theme.heading(t("status.sections.security_audit")));
  const fmtSummary = (value: { critical: number; warn: number; info: number }) => {
    const parts = [
      theme.error(t("status.finding_critical", { count: String(value.critical) })),
      theme.warn(t("status.finding_warn", { count: String(value.warn) })),
      theme.muted(t("status.finding_info", { count: String(value.info) })),
    ];
    return parts.join(" · ");
  };
  runtime.log(theme.muted(t("status.summary_line", { summary: fmtSummary(securityAudit.summary) })));
  const importantFindings = securityAudit.findings.filter(
    (f) => f.severity === "critical" || f.severity === "warn",
  );
  if (importantFindings.length === 0) {
    runtime.log(theme.muted(t("status.no_security_findings")));
  } else {
    const severityLabel = (sev: "critical" | "warn" | "info") => {
      if (sev === "critical") {
        return theme.error("CRITICAL");
      }
      if (sev === "warn") {
        return theme.warn("WARN");
      }
      return theme.muted("INFO");
    };
    const sevRank = (sev: "critical" | "warn" | "info") =>
      sev === "critical" ? 0 : sev === "warn" ? 1 : 2;
    const sorted = [...importantFindings].toSorted(
      (a, b) => sevRank(a.severity) - sevRank(b.severity),
    );
    const shown = sorted.slice(0, 6);
    for (const f of shown) {
      runtime.log(`  ${severityLabel(f.severity)} ${f.title}`);
      runtime.log(`    ${shortenText(f.detail.replaceAll("\n", " "), 160)}`);
      if (f.remediation?.trim()) {
        runtime.log(`    ${theme.muted(t("status.fix", { detail: f.remediation.trim() }))}`);
      }
    }
    if (sorted.length > shown.length) {
      runtime.log(theme.muted(t("common.more_count", { count: String(sorted.length - shown.length) })));
    }
  }
  runtime.log(
    theme.muted(t("status.full_report", { command: formatCliCommand("coreblow security audit") })),
  );
  runtime.log(
    theme.muted(
      t("status.deep_probe", { command: formatCliCommand("coreblow security audit --deep") }),
    ),
  );

  runtime.log("");
  runtime.log(theme.heading(t("status.sections.channels")));
  const channelIssuesByChannel = groupChannelIssuesByChannel(channelIssues);
  runtime.log(
    renderTable({
      width: tableWidth,
      columns: [
        { key: "Channel", header: t("status.table.channel"), minWidth: 10 },
        { key: "Enabled", header: t("status.table.enabled"), minWidth: 7 },
        { key: "State", header: t("status.table.state"), minWidth: 8 },
        { key: "Detail", header: t("status.table.detail"), flex: true, minWidth: 24 },
      ],
      rows: channels.rows.map((row) => {
        const issues = channelIssuesByChannel.get(row.id) ?? [];
        const effectiveState = row.state === "off" ? "off" : issues.length > 0 ? "warn" : row.state;
        const issueSuffix =
          issues.length > 0
            ? ` · ${warn(
                t("status.gateway_issue", {
                  message: shortenText(issues[0]?.message ?? t("common.issue"), 84),
                }),
              )}`
            : "";
        return {
          Channel: row.label,
          Enabled: row.enabled ? ok("ON") : muted("OFF"),
          State:
            effectiveState === "ok"
              ? ok("OK")
              : effectiveState === "warn"
                ? warn("WARN")
                : effectiveState === "off"
                  ? muted("OFF")
                  : theme.accentDim("SETUP"),
          Detail: `${row.detail}${issueSuffix}`,
        };
      }),
    }).trimEnd(),
  );

  runtime.log("");
  runtime.log(theme.heading(t("status.sections.sessions")));
  runtime.log(
    renderTable({
      width: tableWidth,
      columns: [
        { key: "Key", header: t("status.table.key"), minWidth: 20, flex: true },
        { key: "Kind", header: t("status.table.kind"), minWidth: 6 },
        { key: "Age", header: t("status.table.age"), minWidth: 9 },
        { key: "Model", header: t("status.table.model"), minWidth: 14 },
        { key: "Tokens", header: t("status.table.tokens"), minWidth: 16 },
      ],
      rows:
        summary.sessions.recent.length > 0
          ? summary.sessions.recent.map((sess) => ({
              Key: shortenText(sess.key, 32),
              Kind: sess.kind,
              Age: sess.updatedAt ? formatTimeAgo(sess.age) : t("common.no_activity"),
              Model: sess.model ?? t("common.unknown"),
              Tokens: formatTokensCompact(sess),
            }))
          : [
              {
                Key: muted(t("status.no_sessions_yet")),
                Kind: "",
                Age: "",
                Model: "",
                Tokens: "",
              },
            ],
    }).trimEnd(),
  );

  if (summary.queuedSystemEvents.length > 0) {
    runtime.log("");
    runtime.log(theme.heading(t("status.sections.system_events")));
    runtime.log(
      renderTable({
        width: tableWidth,
        columns: [{ key: "Event", header: t("status.table.event"), flex: true, minWidth: 24 }],
        rows: summary.queuedSystemEvents.slice(0, 5).map((event) => ({
          Event: event,
        })),
      }).trimEnd(),
    );
    if (summary.queuedSystemEvents.length > 5) {
      runtime.log(muted(t("common.more_count", { count: String(summary.queuedSystemEvents.length - 5) })));
    }
  }

  if (health) {
    runtime.log("");
    runtime.log(theme.heading(t("status.sections.health")));
    const rows: Array<Record<string, string>> = [];
    rows.push({
      Item: t("status.items.gateway"),
      Status: ok(t("status.reachable")),
      Detail: `${health.durationMs}ms`,
    });

    for (const line of formatHealthChannelLines(health, { accountMode: "all" })) {
      const colon = line.indexOf(":");
      if (colon === -1) {
        continue;
      }
      const item = line.slice(0, colon).trim();
      const detail = line.slice(colon + 1).trim();
      const normalized = detail.toLowerCase();
      const status = (() => {
        if (normalized.startsWith("ok") || normalized.startsWith(t("common.ok").toLowerCase())) {
          return ok("OK");
        }
        if (
          normalized.startsWith("failed") ||
          normalized.startsWith(t("health.failed_prefix").toLowerCase())
        ) {
          return warn("WARN");
        }
        if (
          normalized.startsWith("not configured") ||
          normalized.startsWith(t("health.not_configured").toLowerCase())
        ) {
          return muted("OFF");
        }
        if (
          normalized.startsWith("configured") ||
          normalized.startsWith(t("health.configured").toLowerCase())
        ) {
          return ok("OK");
        }
        if (
          normalized.startsWith("linked") ||
          normalized.startsWith(t("health.linked").toLowerCase())
        ) {
          return ok("LINKED");
        }
        if (
          normalized.startsWith("not linked") ||
          normalized.startsWith(t("health.not_linked").toLowerCase())
        ) {
          return warn("UNLINKED");
        }
        return warn("WARN");
      })();
      rows.push({ Item: item, Status: status, Detail: detail });
    }

    runtime.log(
      renderTable({
        width: tableWidth,
        columns: [
          { key: "Item", header: t("status.table.item"), minWidth: 10 },
          { key: "Status", header: t("status.table.status"), minWidth: 8 },
          { key: "Detail", header: t("status.table.detail"), flex: true, minWidth: 28 },
        ],
        rows,
      }).trimEnd(),
    );
  }

  if (usage) {
    const { formatUsageReportLines } = await loadProviderUsage();
    runtime.log("");
    runtime.log(theme.heading(t("status.sections.usage")));
    for (const line of formatUsageReportLines(usage)) {
      runtime.log(line);
    }
  }

  runtime.log("");
  runtime.log(t("status.faq", { url: "https://docs.coreblow.com/faq" }));
  runtime.log(t("status.troubleshooting", { url: "https://docs.coreblow.com/troubleshooting" }));
  runtime.log("");
  const updateHint = formatUpdateAvailableHint(update);
  if (updateHint) {
    runtime.log(theme.warn(updateHint));
    runtime.log("");
  }
  runtime.log(t("status.next_steps"));
  runtime.log(
    `  ${t("status.need_share")}      ${formatCliCommand("coreblow status --all")}`,
  );
  runtime.log(
    `  ${t("status.need_debug_live")} ${formatCliCommand("coreblow logs --follow")}`,
  );
  if (gatewayReachable) {
    runtime.log(
      `  ${t("status.need_test_channels")} ${formatCliCommand("coreblow status --deep")}`,
    );
  } else {
    runtime.log(
      `  ${t("status.fix_reachability_first")} ${formatCliCommand("coreblow gateway probe")}`,
    );
  }
}
