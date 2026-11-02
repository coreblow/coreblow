#!/usr/bin/env node
/**
 * CoreBlow Lightweight Runtime Benchmark & Metrics Collector
 *
 * Measures:
 * 1. Cold import time & repeated microkernel bootstrap durations (min/median/max)
 * 2. Process memory usage (RSS, heapUsed, heapTotal)
 * 3. Authoritative CoreHub lazy-loading status from AppStoreRuntime and PluginRuntime
 * 4. Package distribution footprint
 * 5. Environment & host architecture metadata
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

async function runBenchmark() {
  const t0 = performance.now();
  const memBefore = process.memoryUsage();

  // Dynamic import of microkernel and runtime
  const { createMicrokernelServiceRegistry } = await import("../src/gateway/microkernel-services.js");
  const { ExtensionTierPolicy } = await import("../src/plugins/extension-tier-policy.js");
  const { bootstrapRuntime } = await import("../src/gateway/provider-bootstrap.js");
  const { listImportedRuntimePluginIds, getActivePluginChannelRegistry } = await import("../src/plugins/runtime.js");

  const importDurationMs = performance.now() - t0;

  // Run repeated bootstrap iterations for reproducible timing statistics
  const ITERATIONS = 5;
  const bootstrapTimings = [];
  let primaryStartResult = null;
  let primaryMicrokernel = null;

  for (let i = 0; i < ITERATIONS; i++) {
    const {
      runtime,
      provider,
      model,
      configured,
      providerRegistry,
      ragPipeline,
      toolRegistry,
      toolExecutor,
      ttsEngine,
      browserTool,
    } = bootstrapRuntime();

    const tIterStart = performance.now();
    const mk = createMicrokernelServiceRegistry({
      providerRegistry,
      activeProvider: provider,
      activeModel: model,
      isProviderConfigured: configured,
      ragPipeline,
      toolRegistry,
      toolExecutor,
      ttsEngine,
      browserTool,
      getActiveSessionKeys: () => runtime.listSessions().map((s) => s.id),
    });

    const startRes = await mk.registry.startAll();
    const iterDurationMs = performance.now() - tIterStart;
    bootstrapTimings.push(iterDurationMs);

    if (i === 0) {
      primaryStartResult = startRes;
      primaryMicrokernel = mk;
    } else {
      await mk.registry.stopAll();
    }
  }

  // Calculate timing statistics
  const sortedTimings = [...bootstrapTimings].sort((a, b) => a - b);
  const minBootstrapMs = sortedTimings[0];
  const maxBootstrapMs = sortedTimings[sortedTimings.length - 1];
  const medianBootstrapMs = sortedTimings[Math.floor(sortedTimings.length / 2)];
  const avgBootstrapMs = sortedTimings.reduce((sum, v) => sum + v, 0) / sortedTimings.length;

  const memAfter = process.memoryUsage();

  // Authoritative CoreHub Lazy-Loading Evidence:
  // Inspect AppStore runtime, active plugin registry, and channel registries
  const installedAppIds = primaryMicrokernel.appStore.getInstalledAppIds();
  const activatedAppIds = primaryMicrokernel.appStore.getActivatedAppIds();
  const loadedAppIds = primaryMicrokernel.appStore.getLoadedAppIds();
  const importedPluginIds = listImportedRuntimePluginIds();
  const channelRegistry = getActivePluginChannelRegistry();

  const communityChannels = [
    "discord", "feishu", "irc", "line", "matrix", "mattermost", "msteams",
    "nextcloud-talk", "nostr", "qqbot", "synology-chat", "tlon", "twitch", "zalo", "zalouser",
  ];

  const loadedCommunityChannels = communityChannels.filter((id) =>
    importedPluginIds.includes(id) || loadedAppIds.includes(id),
  );

  // Calculate dist folder size
  let distSizeBytes = 0;
  const distPath = path.resolve(process.cwd(), "dist");
  if (fs.existsSync(distPath)) {
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile()) {
          distSizeBytes += fs.statSync(full).size;
        }
      }
    };
    walk(distPath);
  }

  const metrics = {
    timestamp: new Date().toISOString(),
    environment: {
      platform: os.platform(),
      arch: os.arch(),
      osRelease: os.release(),
      nodeVersion: process.version,
      cpuCount: os.cpus().length,
      totalMemoryMb: Number((os.totalmem() / (1024 * 1024)).toFixed(0)),
    },
    enforcedGates: {
      servicesRegistered: 8,
      servicesStarted: primaryStartResult.started.length,
      servicesFailed: primaryStartResult.failed.length,
      eagerCoreHubAppsLoaded: loadedAppIds.length,
      eagerCoreHubAppsActivated: activatedAppIds.length,
      communityChannelsImported: loadedCommunityChannels.length,
      status:
        primaryStartResult.failed.length === 0 &&
        loadedAppIds.length === 0 &&
        activatedAppIds.length === 0 &&
        loadedCommunityChannels.length === 0
          ? "PASSED"
          : "FAILED",
    },
    observedBaselines: {
      coldImportMs: Number(importDurationMs.toFixed(2)),
      bootstrapMs: {
        iterations: ITERATIONS,
        min: Number(minBootstrapMs.toFixed(2)),
        median: Number(medianBootstrapMs.toFixed(2)),
        max: Number(maxBootstrapMs.toFixed(2)),
        avg: Number(avgBootstrapMs.toFixed(2)),
      },
      memory: {
        rssMb: Number((memAfter.rss / (1024 * 1024)).toFixed(2)),
        heapUsedMb: Number((memAfter.heapUsed / (1024 * 1024)).toFixed(2)),
        heapTotalMb: Number((memAfter.heapTotal / (1024 * 1024)).toFixed(2)),
        deltaRssMb: Number(((memAfter.rss - memBefore.rss) / (1024 * 1024)).toFixed(2)),
      },
      distribution: {
        distSizeBytes,
        distSizeMb: Number((distSizeBytes / (1024 * 1024)).toFixed(2)),
      },
    },
    authoritativeCoreHubState: {
      installedApps: installedAppIds,
      activatedApps: activatedAppIds,
      loadedApps: loadedAppIds,
      importedRuntimePluginIds: importedPluginIds,
      channelRegistryInitialized: Boolean(channelRegistry),
    },
  };

  await primaryMicrokernel.registry.stopAll();

  return metrics;
}

runBenchmark().then((metrics) => {
  console.log(JSON.stringify(metrics, null, 2));
}).catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
