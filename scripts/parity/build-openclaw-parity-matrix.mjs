#!/usr/bin/env node
/**
 * Build a domain-level OpenClaw parity matrix from audit-oc-parity JSON output.
 *
 * Usage:
 *   node scripts/audit-oc-parity.mjs --json --oc-root=/path/to/openclaw > /tmp/parity.json
 *   node scripts/parity/build-openclaw-parity-matrix.mjs --audit-json=/tmp/parity.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";

const args = process.argv.slice(2);

function readFlag(name, fallback) {
  const prefix = `--${name}=`;
  const flag = args.find((arg) => arg.startsWith(prefix));
  return flag ? flag.slice(prefix.length) : fallback;
}

const auditPath = readFlag("audit-json", undefined);
const outputPath = readFlag(
  "out",
  "scripts/parity/openclaw-parity-matrix.json",
);
const openClawRoot = readFlag(
  "oc-root",
  process.env.OC_ROOT || "/Users/febrinanda/openclaw-refs/openclaw",
);

if (!auditPath) {
  console.error("Missing required --audit-json=<path>");
  process.exit(1);
}

if (!existsSync(auditPath)) {
  console.error(`Audit JSON not found: ${auditPath}`);
  process.exit(1);
}

const audit = JSON.parse(readFileSync(auditPath, "utf8"));

function domainFor(path) {
  const parts = path.split("/");
  if (parts[0] === "extensions") return `extensions/${parts[1]}`;
  if (parts[0] === "packages") return `packages/${parts[1]}`;
  return parts.slice(0, 2).join("/");
}

function addPath(map, path) {
  const domain = domainFor(path);
  const existing = map.get(domain) || [];
  existing.push(path);
  map.set(domain, existing);
}

function collectByDomain(paths) {
  const map = new Map();
  for (const path of paths || []) addPath(map, path);
  return map;
}

const sourceBoth = collectByDomain(audit.source?.both);
const sourceCoreOnly = collectByDomain(audit.source?.cb_only);
const sourceOpenClawOnly = collectByDomain(audit.source?.oc_only);
const testsBoth = collectByDomain(audit.tests?.both_have_test);
const testsCoreOnly = collectByDomain(audit.tests?.cb_has_test_oc_does_not);
const testsOpenClawOnly = collectByDomain(audit.tests?.oc_has_test_cb_does_not);

const domains = [
  ...new Set([
    ...sourceBoth.keys(),
    ...sourceCoreOnly.keys(),
    ...sourceOpenClawOnly.keys(),
    ...testsBoth.keys(),
    ...testsCoreOnly.keys(),
    ...testsOpenClawOnly.keys(),
  ]),
].sort();

const explicitSurfaces = new Map([
  ["src/agents", "src/agents, src/auth, src/agents/turn-engine"],
  ["src/gateway", "src/gateway GatewayServer and ServiceRegistry"],
  ["src/plugin-sdk", "src/plugin-sdk public API"],
  ["src/plugins", "src/plugins PluginLoader, PluginRegistry, HookRunner"],
  ["src/channels", "src/channels, src/routing, extensions channel adapters"],
  ["src/auto-reply", "src/auto-reply inbound reply pipeline"],
  ["src/config", "src/config CoreBlowConfig"],
  ["src/commands", "src/commands and src/cli command classes"],
  ["src/cli", "src/cli program and command wiring"],
  ["packages/memory-host-sdk", "packages/memory-host-sdk"],
]);

const intentionalBehaviorDifferences = new Map([
  [
    "src/cli",
    [
      {
        path: "src/cli/clawbot-cli.ts",
        status: "intentionally_different",
        referenceBehavior: "OpenClaw exposes the branded legacy command group as clawbot.",
        coreBlowDecision:
          "CoreBlow exposes the equivalent QR compatibility command group as corebot via src/cli/corebot-cli.ts.",
        rationale: "Keep the public compatibility surface aligned with CoreBlow product naming.",
        gate: "pnpm test -- src/cli/program/register.subclis.test.ts",
      },
    ],
  ],
  [
    "src/gateway",
    [
      {
        path: "src/gateway/models-http.ts",
        status: "intentionally_different",
        referenceBehavior:
          "OpenClaw grants default OpenAI-compatible operator scopes to shared-secret bearer requests.",
        coreBlowDecision:
          "CoreBlow requires an explicitly declared operator.read scope for shared-secret bearer model-list requests.",
        rationale:
          "Preserve least-privilege scope enforcement on the model discovery surface.",
        gate: "pnpm test -- src/gateway/models-http.test.ts",
      },
      {
        path: "src/gateway/auth.test.ts",
        status: "intentionally_different",
        referenceBehavior:
          "OpenClaw validates OPENCLAW_GATEWAY_* env var compatibility scenarios.",
        coreBlowDecision:
          "CoreBlow keeps gateway auth env var contracts under COREBLOW_* naming.",
        rationale:
          "Avoid promoting OpenClaw-branded environment variables as CoreBlow public API.",
        gate: "pnpm audit:parity:gateway",
      },
      {
        path: "src/gateway/call.test.ts",
        status: "intentionally_different",
        referenceBehavior:
          "OpenClaw validates OPENCLAW_GATEWAY_URL and OPENCLAW_ALLOW_INSECURE_PRIVATE_WS.",
        coreBlowDecision:
          "CoreBlow keeps remote URL and insecure private WS opt-in under CoreBlow-branded configuration.",
        rationale:
          "Preserve CoreBlow product naming on gateway connection and security knobs.",
        gate: "pnpm audit:parity:gateway",
      },
      {
        path: "src/gateway/client.test.ts",
        status: "intentionally_different",
        referenceBehavior:
          "OpenClaw validates OPENCLAW_ALLOW_INSECURE_PRIVATE_WS client behavior.",
        coreBlowDecision:
          "CoreBlow keeps insecure WS compatibility decisions on CoreBlow-branded configuration.",
        rationale:
          "Avoid adding OpenClaw-branded security bypass flags as canonical CoreBlow API.",
        gate: "pnpm audit:parity:gateway",
      },
      {
        path: "src/gateway/connection-auth.test.ts",
        status: "intentionally_different",
        referenceBehavior:
          "OpenClaw tests SecretRef precedence against OPENCLAW env variables.",
        coreBlowDecision:
          "CoreBlow validates SecretRef precedence against CoreBlow config/env naming.",
        rationale:
          "Keep auth precedence semantics without adopting OpenClaw public env names.",
        gate: "pnpm audit:parity:gateway",
      },
      {
        path: "src/gateway/embeddings-http.test.ts",
        status: "intentionally_different",
        referenceBehavior:
          "OpenClaw rejects disallowed x-openclaw-model provider overrides.",
        coreBlowDecision:
          "CoreBlow uses CoreBlow-branded request headers for provider override behavior.",
        rationale:
          "Keep OpenAI-compatible behavior while avoiding OpenClaw-branded headers.",
        gate: "pnpm audit:parity:gateway",
      },
      {
        path: "src/gateway/http-utils.request-context.test.ts",
        status: "intentionally_different",
        referenceBehavior:
          "OpenClaw normalizes x-openclaw-message-channel request context.",
        coreBlowDecision:
          "CoreBlow request context channel headers use CoreBlow naming.",
        rationale:
          "Message-channel request context is parity behavior, but public header naming is CoreBlow-native.",
        gate: "pnpm audit:parity:gateway",
      },
      {
        path: "src/gateway/openai-http.message-channel.test.ts",
        status: "intentionally_different",
        referenceBehavior:
          "OpenClaw passes x-openclaw-message-channel through OpenAI-compatible HTTP.",
        coreBlowDecision:
          "CoreBlow preserves message-channel behavior with CoreBlow header naming.",
        rationale:
          "Avoid exposing OpenClaw-branded HTTP headers as CoreBlow contract.",
        gate: "pnpm audit:parity:gateway",
      },
    ],
  ],
]);

const intentionalDomainDifferences = new Map([
  [
    "extensions/voyage",
    {
      status: "intentionally_different",
      referenceBehavior:
        "OpenClaw ships Voyage as a standalone extension that registers a memory embedding provider.",
      coreBlowDecision:
        "CoreBlow registers Voyage as a built-in memory embedding provider from the memory-core extension.",
      rationale:
        "Avoid loading two providers with the same id while keeping Voyage available through CoreBlow's consolidated memory provider architecture.",
      evidence: [
        "extensions/memory-core/src/memory/provider-adapters.ts",
        "extensions/memory-core/index.ts",
      ],
      gate: "pnpm test -- extensions/memory-core",
    },
  ],
  [
    "extensions/web-readability",
    {
      status: "intentionally_different",
      referenceBehavior:
        "OpenClaw ships Readability extraction as a standalone web-readability extension with a narrow extractor artifact.",
      coreBlowDecision:
        "CoreBlow keeps the same readability extraction behavior inside the built-in web-fetch runtime instead of exposing a separate plugin package.",
      rationale:
        "Preserve behavior parity while keeping Readability on the hot web-fetch path and avoiding a duplicate plugin-only abstraction.",
      evidence: [
        "src/agents/tools/web-fetch-utils.ts",
        "src/agents/tools/web-fetch.ts",
        "src/agents/tools/web-tools.readability.test.ts",
      ],
      gate: "pnpm test -- src/agents/tools/web-tools.readability.test.ts",
    },
  ],
]);

function implementationSurface(domain) {
  if (explicitSurfaces.has(domain)) return explicitSurfaces.get(domain);
  if (domain.startsWith("extensions/")) {
    return `${domain} plus plugin-sdk channel/runtime surfaces`;
  }
  return domain;
}

function gateTarget(domain) {
  if (domain.startsWith("extensions/")) return domain;
  if (domain.startsWith("packages/")) return domain;
  return domain;
}

function count(map, domain) {
  return (map.get(domain) || []).length;
}

function sample(map, domain) {
  return (map.get(domain) || []).slice(0, 12);
}

function statusFor({
  sharedSource,
  sharedTests,
  openClawOnlySource,
  openClawOnlyTests,
  coreOnlySource,
  coreOnlyTests,
}) {
  const shared = sharedSource + sharedTests;
  const openClawOnly = openClawOnlySource + openClawOnlyTests;
  const coreOnly = coreOnlySource + coreOnlyTests;

  if (openClawOnly > 0 && shared > 0) return "partial";
  if (openClawOnly > 0 && shared === 0) return "missing";
  if (openClawOnly === 0 && shared > 0) return "done";
  if (openClawOnly === 0 && coreOnly > 0) return "intentionally_different";
  return "missing";
}

function priorityFor({ openClawOnly, openClawTestGap }) {
  const totalGap = openClawOnly + openClawTestGap;
  if (totalGap >= 200) return "P0";
  if (totalGap >= 80) return "P1";
  if (totalGap >= 20) return "P2";
  return "P3";
}

const matrix = domains
  .map((domain) => {
    const counts = {
      sharedSourcePaths: count(sourceBoth, domain),
      coreBlowOnlySourcePaths: count(sourceCoreOnly, domain),
      openClawOnlySourcePaths: count(sourceOpenClawOnly, domain),
      sharedTestPaths: count(testsBoth, domain),
      coreBlowOnlyTestPaths: count(testsCoreOnly, domain),
      openClawTestGaps: count(testsOpenClawOnly, domain),
    };
    const computedStatus = statusFor({
      sharedSource: counts.sharedSourcePaths,
      sharedTests: counts.sharedTestPaths,
      coreOnlySource: counts.coreBlowOnlySourcePaths,
      coreOnlyTests: counts.coreBlowOnlyTestPaths,
      openClawOnlySource: counts.openClawOnlySourcePaths,
      openClawOnlyTests: counts.openClawTestGaps,
    });
    const intentionalDomainDifference = intentionalDomainDifferences.get(domain);
    const status = intentionalDomainDifference?.status ?? computedStatus;

    return {
      domain,
      status,
      priority: priorityFor({
        openClawOnly: counts.openClawOnlySourcePaths,
        openClawTestGap: counts.openClawTestGaps,
      }),
      implementationSurface: implementationSurface(domain),
      counts,
      samples: {
        openClawOnlySourcePaths: sample(sourceOpenClawOnly, domain),
        openClawTestGapPaths: sample(testsOpenClawOnly, domain),
        coreBlowOnlySourcePaths: sample(sourceCoreOnly, domain),
      },
      ...(intentionalBehaviorDifferences.has(domain)
        ? { intentionalBehaviorDifferences: intentionalBehaviorDifferences.get(domain) }
        : {}),
      ...(intentionalDomainDifference
        ? { intentionalDomainDifference }
        : {}),
      notes:
        status === "intentionally_different"
          ? intentionalDomainDifference
            ? "OpenClaw behavior is covered by a deliberate CoreBlow architecture placement."
            : "CoreBlow-owned surface. Keep only if it supports CoreBlow product architecture."
          : "Read OpenClaw behavior first, then implement CoreBlow-native OOP/DI parity.",
      gates: [
        intentionalDomainDifference?.gate ?? `pnpm test -- ${gateTarget(domain)}`,
        "pnpm check",
      ],
    };
  })
  .sort((a, b) => {
    const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
    return (
      order[a.priority] - order[b.priority] ||
      b.counts.openClawOnlySourcePaths + b.counts.openClawTestGaps -
        (a.counts.openClawOnlySourcePaths + a.counts.openClawTestGaps) ||
      a.domain.localeCompare(b.domain)
    );
  });

const result = {
  schemaVersion: 1,
  generatedDate: "2026-05-26",
  reference: {
    coreBlowRoot: ".",
    openClawRoot,
    auditJson: auditPath.startsWith("/tmp/") ? null : relative(process.cwd(), auditPath),
  },
  summary: audit.summary,
  statusLegend: {
    done: "Shared source or test coverage exists and no OpenClaw-only source or test paths were found for this domain.",
    partial: "Both repos have this domain, but OpenClaw has additional source paths or tests to map.",
    missing: "OpenClaw has this domain and CoreBlow has no shared source or test path for it.",
    intentionally_different: "CoreBlow-only domain; keep only when it is a deliberate CoreBlow product or architecture surface.",
  },
  behaviorDecisionLegend:
    "A domain can remain partial while a specific shared path deliberately keeps CoreBlow behavior that differs from OpenClaw.",
  matrix,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);

const counts = matrix.reduce((acc, row) => {
  acc[row.status] = (acc[row.status] || 0) + 1;
  return acc;
}, {});

console.log(`Wrote ${outputPath}`);
console.log(JSON.stringify({ rows: matrix.length, statuses: counts }, null, 2));
