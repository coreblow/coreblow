/**
 * CoreBlow Sovereign Agent-OS v2.0.0
 * Sovereign Release Readiness Gates - Adversarial Stress Test Suite
 *
 * Empirical validation of correctness, robustness, boundary handling,
 * and zero false passes across all 5 sovereign release readiness gates.
 *
 * NOTE: In strict accordance with Brand Sovereignty Invariants, all legacy
 * test tokens are synthesized dynamically from character codes.
 */

import { describe, expect, it } from "vitest";
import {
  compileSovereignReleaseManifest,
  DEFAULT_FORBIDDEN_BRAND_TOKENS,
  evaluateSovereignReleaseGates,
  MINIMUM_COREHUB_CATALOG_ARTIFACT_COUNT,
  REQUIRED_MICROKERNEL_SERVICES,
} from "./sovereign-release-certifier.js";

// Helper: dynamic token synthesis via character codes
function synthesize(codes: readonly number[]): string {
  return String.fromCharCode(...codes);
}

// Canonical character codes for legacy competitor tokens
const CODES_LEGACY_1 = [111, 112, 101, 110, 99, 108, 97, 119] as const;
const CODES_LEGACY_2 = [99, 108, 97, 119, 100, 98, 111, 116] as const;
const CODES_LEGACY_3 = [109, 111, 108, 116, 98, 111, 116] as const;
const CODES_LEGACY_4 = [99, 108, 97, 119, 100] as const;
const CODES_LEGACY_5 = [99, 108, 97, 119, 98, 111, 116] as const;

function makeCleanParams() {
  return {
    microkernelServices: REQUIRED_MICROKERNEL_SERVICES,
    coreHubArtifactCount: 15,
    stagedFilePaths: [
      "src/index.ts",
      "src/infra/release/sovereign-release-certifier.ts",
      "docs/ARCHITECTURE.md",
      "package.json",
    ],
    sourceSnippets: [
      "export const SYSTEM = 'CoreBlow Sovereign Agent-OS';",
      "const version = '2.0.0';",
    ],
  };
}

describe("Adversarial Stress Suite - microkernel_health Gate", () => {
  it("fails when microkernelServices is completely empty or undefined", () => {
    const rEmptyArray = evaluateSovereignReleaseGates({ microkernelServices: [] });
    const gateEmpty = rEmptyArray.find((g) => g.gate === "microkernel_health");
    expect(gateEmpty?.passed).toBe(false);
    expect(gateEmpty?.violations).toHaveLength(12);

    const rEmptyObj = evaluateSovereignReleaseGates({ microkernelServices: {} });
    const gateEmptyObj = rEmptyObj.find((g) => g.gate === "microkernel_health");
    expect(gateEmptyObj?.passed).toBe(false);
    expect(gateEmptyObj?.violations).toHaveLength(12);

    const rUndef = evaluateSovereignReleaseGates({});
    const gateUndef = rUndef.find((g) => g.gate === "microkernel_health");
    expect(gateUndef?.passed).toBe(false);
    expect(gateUndef?.violations).toHaveLength(12);
  });

  it("fails when any single required service is omitted (12 individual permutations)", () => {
    for (const serviceToOmit of REQUIRED_MICROKERNEL_SERVICES) {
      const subset = REQUIRED_MICROKERNEL_SERVICES.filter((s) => s !== serviceToOmit);
      const results = evaluateSovereignReleaseGates({ microkernelServices: subset });
      const gate = results.find((g) => g.gate === "microkernel_health");
      expect(gate?.passed).toBe(false);
      expect(gate?.violations).toHaveLength(1);
      expect(gate?.violations?.[0]).toContain(serviceToOmit);
    }
  });

  it("fails when any single required service has healthy === false (12 individual permutations)", () => {
    for (const serviceToDegrade of REQUIRED_MICROKERNEL_SERVICES) {
      const services = REQUIRED_MICROKERNEL_SERVICES.map((name) => ({
        name,
        healthy: name !== serviceToDegrade,
        status: name === serviceToDegrade ? "degraded" : "healthy",
      }));
      const results = evaluateSovereignReleaseGates({ microkernelServices: services });
      const gate = results.find((g) => g.gate === "microkernel_health");
      expect(gate?.passed).toBe(false);
      expect(gate?.violations?.some((v) => v.includes(serviceToDegrade))).toBe(true);
    }
  });

  it("handles arbitrary service order permutations without affecting gate decision", () => {
    // Reverse order
    const reversed = [...REQUIRED_MICROKERNEL_SERVICES].reverse();
    const rReversed = evaluateSovereignReleaseGates({ microkernelServices: reversed });
    expect(rReversed.find((g) => g.gate === "microkernel_health")?.passed).toBe(true);

    // Pseudorandom shuffled orders
    for (let seed = 1; seed <= 5; seed++) {
      const shuffled = [...REQUIRED_MICROKERNEL_SERVICES].sort(() => (seed % 2 === 0 ? 1 : -1));
      const rShuffled = evaluateSovereignReleaseGates({ microkernelServices: shuffled });
      expect(rShuffled.find((g) => g.gate === "microkernel_health")?.passed).toBe(true);
    }
  });

  it("passes when extra unknown services are registered alongside the 12 required ones", () => {
    const augmented = [
      ...REQUIRED_MICROKERNEL_SERVICES,
      "custom-analytics-engine",
      "experimental-telemetry-sink",
      "third-party-connector",
    ];
    const results = evaluateSovereignReleaseGates({ microkernelServices: augmented });
    const gate = results.find((g) => g.gate === "microkernel_health");
    expect(gate?.passed).toBe(true);
  });

  it("passes when an unknown service is degraded, provided all 12 required services are healthy", () => {
    const services = [
      ...REQUIRED_MICROKERNEL_SERVICES.map((name) => ({ name, healthy: true, status: "healthy" })),
      { name: "experimental-opt-in-service", healthy: false, status: "failed" },
    ];
    const results = evaluateSovereignReleaseGates({ microkernelServices: services });
    const gate = results.find((g) => g.gate === "microkernel_health");
    expect(gate?.passed).toBe(true);
  });

  it("handles malformed entries in microkernelServices array gracefully without crashing", () => {
    const malformedServices = [
      ...REQUIRED_MICROKERNEL_SERVICES,
      null,
      undefined,
      12345,
      {},
      { name: "" },
      { name: null },
      { name: 456 },
    ] as unknown as readonly string[];

    const results = evaluateSovereignReleaseGates({ microkernelServices: malformedServices });
    const gate = results.find((g) => g.gate === "microkernel_health");
    expect(gate?.passed).toBe(true);
  });

  it("detects casing and whitespace mismatches as missing required services", () => {
    // Uppercase service name
    const uppercaseServices = REQUIRED_MICROKERNEL_SERVICES.map((s) =>
      s === "voice-runtime" ? "VOICE-RUNTIME" : s,
    );
    const rUpper = evaluateSovereignReleaseGates({ microkernelServices: uppercaseServices });
    expect(rUpper.find((g) => g.gate === "microkernel_health")?.passed).toBe(false);

    // Whitespace-padded service name
    const paddedServices = REQUIRED_MICROKERNEL_SERVICES.map((s) =>
      s === "browser-runtime" ? " browser-runtime " : s,
    );
    const rPadded = evaluateSovereignReleaseGates({ microkernelServices: paddedServices });
    expect(rPadded.find((g) => g.gate === "microkernel_health")?.passed).toBe(false);
  });

  it("handles health() method returning complex or degraded health objects", () => {
    const mapOfServices: Record<string, unknown> = {};
    for (const name of REQUIRED_MICROKERNEL_SERVICES) {
      if (name === "cory-knowledge-scribe") {
        mapOfServices[name] = {
          health: () => ({ status: "unhealthy", healthy: false, detail: "DB lock" }),
        };
      } else {
        mapOfServices[name] = {
          health: () => ({ status: "healthy", healthy: true }),
        };
      }
    }

    const results = evaluateSovereignReleaseGates({
      microkernelServices: mapOfServices as unknown as Record<string, boolean>,
    });
    const gate = results.find((g) => g.gate === "microkernel_health");
    expect(gate?.passed).toBe(false);
    expect(gate?.violations?.some((v) => v.includes("cory-knowledge-scribe"))).toBe(true);
  });

  it("respects activeServices override over healthy microkernelServices", () => {
    const results = evaluateSovereignReleaseGates({
      microkernelServices: REQUIRED_MICROKERNEL_SERVICES,
      activeServices: [
        { name: "war-room-orchestrator", healthy: false, status: "crashed" },
      ],
    });
    const gate = results.find((g) => g.gate === "microkernel_health");
    expect(gate?.passed).toBe(false);
    expect(gate?.violations?.some((v) => v.includes("war-room-orchestrator"))).toBe(true);
  });
});

describe("Adversarial Stress Suite - brand_sovereignty Gate", () => {
  it("detects tokens embedded in diverse syntactic constructs (URLs, paths, comments, identifiers)", () => {
    const token1 = synthesize(CODES_LEGACY_1);
    const token2 = synthesize(CODES_LEGACY_2);
    const token3 = synthesize(CODES_LEGACY_3);
    const token4 = synthesize(CODES_LEGACY_4);
    const token5 = synthesize(CODES_LEGACY_5);

    const adversarialSnippets = [
      `const url = "https://registry.npmjs.org/@coreblow/${token1}-adapter";`,
      `const p = "/var/log/system/${token2}.log";`,
      `// Deprecated migration path from ${token3}`,
      `export class ${token4}MigrationShim {}`,
      `/* ${token5} daemon handler */`,
      `const key = "env_var_${token1.toUpperCase()}_token";`,
    ];

    const results = evaluateSovereignReleaseGates({
      sourceSnippets: adversarialSnippets,
    });
    const gate = results.find((g) => g.gate === "brand_sovereignty");
    expect(gate?.passed).toBe(false);
    expect(gate?.violations?.length).toBeGreaterThanOrEqual(6);
  });

  it("detects varied casing permutations: lower, UPPER, TitleCase, and alternating cAsE", () => {
    const base = synthesize(CODES_LEGACY_1);
    const upper = base.toUpperCase();
    const title = base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
    const alternating = base
      .split("")
      .map((ch, idx) => (idx % 2 === 0 ? ch.toUpperCase() : ch.toLowerCase()))
      .join("");

    const snippets = [
      `const a = "${base}";`,
      `const b = "${upper}";`,
      `const c = "${title}";`,
      `const d = "${alternating}";`,
    ];

    const results = evaluateSovereignReleaseGates({ sourceSnippets: snippets });
    const gate = results.find((g) => g.gate === "brand_sovereignty");
    expect(gate?.passed).toBe(false);
    expect(gate?.violations).toHaveLength(4);
  });

  it("passes negative tests for legitimate lookalike tokens that are not forbidden", () => {
    const cleanLookalikeSnippets = [
      "const item = 'open';",
      "const tool = 'claw';",
      "const bot = 'robot';",
      "const molten = 'molten lava';",
      "const sovereign = 'CoreBlow Agent-OS';",
    ];

    const results = evaluateSovereignReleaseGates({ sourceSnippets: cleanLookalikeSnippets });
    const gate = results.find((g) => g.gate === "brand_sovereignty");
    expect(gate?.passed).toBe(true);
    expect(gate?.violations).toBeUndefined();
  });

  it("handles malformed sourceSnippets (null, undefined, numbers, objects) without crashing", () => {
    const malformedSnippets = [
      null,
      undefined,
      12345,
      { text: "sample" },
      "const valid = true;",
    ] as unknown as readonly string[];

    const results = evaluateSovereignReleaseGates({ sourceSnippets: malformedSnippets });
    const gate = results.find((g) => g.gate === "brand_sovereignty");
    expect(gate?.passed).toBe(true);
  });

  it("handles custom forbiddenBrandTokens with empty or invalid elements gracefully", () => {
    const customTokens = ["", null, undefined, "custom-legacy-mark"] as unknown as readonly string[];
    const snippets = ["const legacy = 'custom-legacy-mark-instance';"];

    const results = evaluateSovereignReleaseGates({
      sourceSnippets: snippets,
      forbiddenBrandTokens: customTokens,
    });
    const gate = results.find((g) => g.gate === "brand_sovereignty");
    expect(gate?.passed).toBe(false);
    expect(gate?.violations).toHaveLength(1);
  });
});

describe("Adversarial Stress Suite - private_artifact_exclusion Gate", () => {
  it("detects .env variants in any directory depth and with Windows or Unix separators", () => {
    const paths = [
      ".env",
      "./.env",
      "../.env",
      "config/.env",
      "config/.env.local",
      "config/.env.production.local",
      "nested/deep/directory/.env.test",
      "windows\\system\\.env",
      "windows\\system\\.env.staging",
      "/absolute/root/path/.env",
    ];

    for (const p of paths) {
      const results = evaluateSovereignReleaseGates({ stagedFilePaths: [p] });
      const gate = results.find((g) => g.gate === "private_artifact_exclusion");
      expect(gate?.passed).toBe(false);
      expect(gate?.violations?.[0]).toContain(p);
    }
  });

  it("does not false-positive on legitimate public files containing 'env'", () => {
    const legitimatePaths = [
      "src/infra/environment.ts",
      "src/config/dotenv-loader.ts",
      "docs/environment-variables.md",
      "test/fixtures/env-sample.json",
      "src/types/env.d.ts",
    ];

    const results = evaluateSovereignReleaseGates({ stagedFilePaths: legitimatePaths });
    const gate = results.find((g) => g.gate === "private_artifact_exclusion");
    expect(gate?.passed).toBe(true);
    expect(gate?.violations).toBeUndefined();
  });

  it("detects .evidence and .agents directory artifacts across all path structures", () => {
    const paths = [
      ".evidence/run.log",
      ".evidence",
      "sub/.evidence/data.json",
      "C:\\repo\\.evidence\\snapshot.tar",
      ".agents/handoff.md",
      ".agents/teamwork/plan.md",
      "nested/workspace/.agents/memory.db",
      "dir\\.agents\\audit.txt",
    ];

    for (const p of paths) {
      const results = evaluateSovereignReleaseGates({ stagedFilePaths: [p] });
      const gate = results.find((g) => g.gate === "private_artifact_exclusion");
      expect(gate?.passed).toBe(false);
    }
  });

  it("detects ANTIGRAVITY internal docs and private PRDs regardless of directory prefix", () => {
    const paths = [
      "ANTIGRAVITY_NOTES.md",
      "docs/ANTIGRAVITY_STAGE9.md",
      "specs/ANTIGRAVITY_AUDIT.md",
      "docs\\ANTIGRAVITY_V2.md",
      "docs/COREBLOW_COMPREHENSIVE_AUDIT_REPORT.md",
      "docs/COREBLOW_ECOSYSTEM_26_REPOS.md",
      "docs/CORY_MEMORY_PRD.md",
      "docs/MICROKERNEL_HYBRID_UPGRADE_PRD.md",
      "docs/CORY_SKILL_EVOLUTION_PRD.md",
      "docs\\COREBLOW_COMPREHENSIVE_AUDIT_REPORT.md",
    ];

    for (const p of paths) {
      const results = evaluateSovereignReleaseGates({ stagedFilePaths: [p] });
      const gate = results.find((g) => g.gate === "private_artifact_exclusion");
      expect(gate?.passed).toBe(false);
    }
  });

  it("handles malformed stagedFilePaths entries (null, undefined, numbers) safely", () => {
    const malformedPaths = [
      null,
      undefined,
      42,
      { path: "src/index.ts" },
      "src/legitimate-file.ts",
    ] as unknown as readonly string[];

    const results = evaluateSovereignReleaseGates({ stagedFilePaths: malformedPaths });
    const gate = results.find((g) => g.gate === "private_artifact_exclusion");
    expect(gate?.passed).toBe(true);
  });
});

describe("Adversarial Stress Suite - security_invariants Gate", () => {
  it("detects edge-case credential prefixes and formats across multiple providers", () => {
    const edgeCaseSecrets = [
      // Anthropic with non-standard prefix length
      "const a = 'sk-ant-admin01-ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';",
      // OpenAI project key
      "const b = 'sk-proj-99999999999999999999999999999999999';",
      // GitHub PAT
      "const c = 'github_pat_11AAAAAAA_0123456789abcdef0123456789';",
      // Slack bot token
      "const d = 'xoxb-9876543210-abcdef012345';",
      // Google Cloud key
      "const e = 'AIzaSyD-0123456789_abcdefghijklmnopq';",
    ];

    for (const secret of edgeCaseSecrets) {
      const results = evaluateSovereignReleaseGates({ sourceSnippets: [secret] });
      const gate = results.find((g) => g.gate === "security_invariants");
      expect(gate?.passed).toBe(false);
      expect(gate?.violations).toHaveLength(1);
    }
  });

  it("detects multiline private keys across diverse key types (RSA, EC, OPENSSH, Generic)", () => {
    const keySnippets = [
      "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA012345\n-----END RSA PRIVATE KEY-----",
      "-----BEGIN EC PRIVATE KEY-----\nMHcCAQEEI...\n-----END EC PRIVATE KEY-----",
      "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAA...\n-----END OPENSSH PRIVATE KEY-----",
      "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQ...\n-----END PRIVATE KEY-----",
    ];

    for (const key of keySnippets) {
      const results = evaluateSovereignReleaseGates({ sourceSnippets: [key] });
      const gate = results.find((g) => g.gate === "security_invariants");
      expect(gate?.passed).toBe(false);
      expect(gate?.violations?.some((v) => v.includes("Private Key"))).toBe(true);
    }
  });

  it("detects private key phrases with various whitespace separators (spaces, tabs, newlines)", () => {
    const whitespaceVariants = [
      "const text = 'PRIVATE KEY';",
      "const text = 'PRIVATE    KEY';",
      "const text = 'PRIVATE\tKEY';",
      "const text = 'PRIVATE\nKEY';",
      "const text = 'private key';",
    ];

    for (const snip of whitespaceVariants) {
      const results = evaluateSovereignReleaseGates({ sourceSnippets: [snip] });
      const gate = results.find((g) => g.gate === "security_invariants");
      expect(gate?.passed).toBe(false);
    }
  });

  it("passes negative tests for ordinary words and safe identifiers", () => {
    const safeSnippets = [
      "const deskKey = 'wooden-desk';",
      "const taskPrefix = 'task-12345';",
      "const mask = 'bitmask-operation';",
      "export type PrivateKeyType = string;", // Identifier without whitespace
      "const askUser = true;",
      "const shortKey = 'sk-short';", // under minimum 15 char threshold
      "const shortAnt = 'sk-ant-1';", // under minimum 8 char threshold
    ];

    const results = evaluateSovereignReleaseGates({ sourceSnippets: safeSnippets });
    const gate = results.find((g) => g.gate === "security_invariants");
    expect(gate?.passed).toBe(true);
    expect(gate?.violations).toBeUndefined();
  });
});

describe("Adversarial Stress Suite - corehub_catalog_integrity Gate", () => {
  it("enforces strict boundary checks around the threshold value 15", () => {
    const testCases: Array<{ count: number; expectedPassed: boolean }> = [
      { count: 0, expectedPassed: false },
      { count: 1, expectedPassed: false },
      { count: 14, expectedPassed: false },
      { count: 14.99, expectedPassed: false },
      { count: 15, expectedPassed: true },
      { count: 15.01, expectedPassed: true },
      { count: 16, expectedPassed: true },
      { count: 100, expectedPassed: true },
      { count: 10000, expectedPassed: true },
    ];

    for (const tc of testCases) {
      const results = evaluateSovereignReleaseGates({ coreHubArtifactCount: tc.count });
      const gate = results.find((g) => g.gate === "corehub_catalog_integrity");
      expect(gate?.passed).toBe(tc.expectedPassed);
    }
  });

  it("fails when coreHubArtifactCount is negative or undefined", () => {
    const rNeg = evaluateSovereignReleaseGates({ coreHubArtifactCount: -1 });
    expect(rNeg.find((g) => g.gate === "corehub_catalog_integrity")?.passed).toBe(false);

    const rNeg10 = evaluateSovereignReleaseGates({ coreHubArtifactCount: -10 });
    expect(rNeg10.find((g) => g.gate === "corehub_catalog_integrity")?.passed).toBe(false);

    const rUndef = evaluateSovereignReleaseGates({});
    expect(rUndef.find((g) => g.gate === "corehub_catalog_integrity")?.passed).toBe(false);
  });
});

describe("Adversarial Stress Suite - Release Manifest Signing & Overall Gate Aggregation", () => {
  it("sets allGatesPassed to true if and only if every single gate passes", () => {
    const cleanParams = makeCleanParams();
    const manifestHealthy = compileSovereignReleaseManifest(cleanParams);
    expect(manifestHealthy.allGatesPassed).toBe(true);

    // Fail gate 1
    const m1 = compileSovereignReleaseManifest({ ...cleanParams, microkernelServices: [] });
    expect(m1.allGatesPassed).toBe(false);

    // Fail gate 2
    const m2 = compileSovereignReleaseManifest({
      ...cleanParams,
      sourceSnippets: [`const x = '${synthesize(CODES_LEGACY_1)}';`],
    });
    expect(m2.allGatesPassed).toBe(false);

    // Fail gate 3
    const m3 = compileSovereignReleaseManifest({
      ...cleanParams,
      stagedFilePaths: [".env"],
    });
    expect(m3.allGatesPassed).toBe(false);

    // Fail gate 4
    const m4 = compileSovereignReleaseManifest({
      ...cleanParams,
      sourceSnippets: ["const key = 'sk-ant-api03-abcdef1234567890';"],
    });
    expect(m4.allGatesPassed).toBe(false);

    // Fail gate 5
    const m5 = compileSovereignReleaseManifest({
      ...cleanParams,
      coreHubArtifactCount: 14,
    });
    expect(m5.allGatesPassed).toBe(false);
  });

  it("produces deterministic SHA-256 digests invariant to object property key order", () => {
    const params1 = makeCleanParams();
    const params2 = {
      sourceSnippets: params1.sourceSnippets,
      coreHubArtifactCount: params1.coreHubArtifactCount,
      microkernelServices: params1.microkernelServices,
      stagedFilePaths: params1.stagedFilePaths,
    };

    const manifest1 = compileSovereignReleaseManifest(params1);
    const manifest2 = compileSovereignReleaseManifest(params2);

    expect(manifest1.manifestSha256).toBe(manifest2.manifestSha256);
    expect(manifest1.manifestSha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
