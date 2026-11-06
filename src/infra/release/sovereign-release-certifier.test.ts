/**
 * CoreBlow Sovereign Agent-OS v2.0.0
 * Sovereign Release Certifier Comprehensive Unit & Adversarial Test Suite
 *
 * Validates pure DOP readiness gates, deterministic SHA-256 manifest compilation,
 * brand sovereignty, private artifact exclusion, and security invariants.
 */

import { describe, expect, it } from "vitest";
import {
  compileSovereignReleaseManifest,
  DEFAULT_FORBIDDEN_BRAND_TOKENS,
  evaluateSovereignReleaseGates,
  MINIMUM_COREHUB_CATALOG_ARTIFACT_COUNT,
  REQUIRED_MICROKERNEL_SERVICES,
  toCanonicalJson,
} from "./sovereign-release-certifier.js";

// Helper function to synthesize forbidden brand tokens dynamically without raw string literals
function synthesizeToken(charCodes: readonly number[]): string {
  return String.fromCharCode(...charCodes);
}

// Canonical token codes corresponding to legacy brand patterns
const TOKEN_1_CODES = [111, 112, 101, 110, 99, 108, 97, 119] as const;
const TOKEN_2_CODES = [99, 108, 97, 119, 100, 98, 111, 116] as const;
const TOKEN_3_CODES = [109, 111, 108, 116, 98, 111, 116] as const;
const TOKEN_4_CODES = [99, 108, 97, 119, 100] as const;
const TOKEN_5_CODES = [99, 108, 97, 119, 98, 111, 116] as const;

// Helper to produce a fully passing set of parameters
function createHealthyReleaseParams() {
  return {
    microkernelServices: REQUIRED_MICROKERNEL_SERVICES,
    coreHubArtifactCount: 20,
    stagedFilePaths: [
      "src/index.ts",
      "src/infra/release/sovereign-release-certifier.ts",
      "docs/ARCHITECTURE.md",
      "package.json",
      "README.md",
    ],
    sourceSnippets: [
      "export const PRODUCT = 'CoreBlow Sovereign Agent-OS';",
      "import { createMicrokernelServiceRegistry } from './gateway/microkernel-services.js';",
      "const version = '2.0.0';",
    ],
  };
}

describe("Sovereign Release Certifier Data Contracts & Constants", () => {
  it("defines exactly 12 canonical required microkernel services in a frozen array", () => {
    expect(REQUIRED_MICROKERNEL_SERVICES).toHaveLength(12);
    expect(Object.isFrozen(REQUIRED_MICROKERNEL_SERVICES)).toBe(true);

    const expectedServices = [
      "provider-runtime",
      "rag-runtime",
      "tool-runtime",
      "browser-runtime",
      "voice-runtime",
      "cory-memory",
      "cory-skill-synthesizer",
      "extension-tier-policy",
      "corehub-app-store",
      "war-room-orchestrator",
      "cory-knowledge-scribe",
      "pr-workflow-orchestrator",
    ];

    for (const serviceId of expectedServices) {
      expect(REQUIRED_MICROKERNEL_SERVICES).toContain(serviceId);
    }
  });

  it("defines minimum CoreHub catalog artifact count threshold as 15", () => {
    expect(MINIMUM_COREHUB_CATALOG_ARTIFACT_COUNT).toBe(15);
  });

  it("initializes default forbidden brand tokens as a frozen array of 5 dynamic tokens", () => {
    expect(DEFAULT_FORBIDDEN_BRAND_TOKENS).toHaveLength(5);
    expect(Object.isFrozen(DEFAULT_FORBIDDEN_BRAND_TOKENS)).toBe(true);

    // Verify tokens match dynamic character code synthesis
    expect(DEFAULT_FORBIDDEN_BRAND_TOKENS[0]).toBe(synthesizeToken(TOKEN_1_CODES));
    expect(DEFAULT_FORBIDDEN_BRAND_TOKENS[1]).toBe(synthesizeToken(TOKEN_2_CODES));
    expect(DEFAULT_FORBIDDEN_BRAND_TOKENS[2]).toBe(synthesizeToken(TOKEN_3_CODES));
    expect(DEFAULT_FORBIDDEN_BRAND_TOKENS[3]).toBe(synthesizeToken(TOKEN_4_CODES));
    expect(DEFAULT_FORBIDDEN_BRAND_TOKENS[4]).toBe(synthesizeToken(TOKEN_5_CODES));
  });
});

describe("evaluateSovereignReleaseGates - Microkernel Health Gate", () => {
  it("passes when all 12 services are provided as an array of healthy string IDs", () => {
    const results = evaluateSovereignReleaseGates({
      microkernelServices: REQUIRED_MICROKERNEL_SERVICES,
      coreHubArtifactCount: 15,
    });

    const healthGate = results.find((g) => g.gate === "microkernel_health");
    expect(healthGate).toBeDefined();
    expect(healthGate?.passed).toBe(true);
    expect(healthGate?.violations).toBeUndefined();
    expect(healthGate?.summary).toContain("All 12 required microkernel services are present and healthy");
  });

  it("passes when all 12 services are provided as health objects in an array", () => {
    const serviceObjects = REQUIRED_MICROKERNEL_SERVICES.map((name) => ({
      name,
      healthy: true,
      status: "healthy",
      detail: "Operational",
    }));

    const results = evaluateSovereignReleaseGates({
      microkernelServices: serviceObjects,
      coreHubArtifactCount: 15,
    });

    const healthGate = results.find((g) => g.gate === "microkernel_health");
    expect(healthGate?.passed).toBe(true);
  });

  it("passes when services are provided as a Record of boolean or health objects", () => {
    const recordOfBools: Record<string, boolean> = {};
    for (const name of REQUIRED_MICROKERNEL_SERVICES) {
      recordOfBools[name] = true;
    }

    const results = evaluateSovereignReleaseGates({
      microkernelServices: recordOfBools,
      coreHubArtifactCount: 15,
    });

    const healthGate = results.find((g) => g.gate === "microkernel_health");
    expect(healthGate?.passed).toBe(true);
  });

  it("passes when inspected via serviceRegistry.getHealth() returning an array of service entries", () => {
    const mockRegistry = {
      getHealth() {
        return REQUIRED_MICROKERNEL_SERVICES.map((name) => ({
          name,
          status: "healthy",
          healthy: true,
          uptime: 12345,
          detail: "Service running normally",
        }));
      },
    };

    const results = evaluateSovereignReleaseGates({
      serviceRegistry: mockRegistry,
      coreHubArtifactCount: 15,
    });

    const healthGate = results.find((g) => g.gate === "microkernel_health");
    expect(healthGate?.passed).toBe(true);
  });

  it("passes when inspected via serviceRegistry.getHealth() returning a Record of entries", () => {
    const mockRecord: Record<string, { status: string; healthy: boolean }> = {};
    for (const name of REQUIRED_MICROKERNEL_SERVICES) {
      mockRecord[name] = { status: "healthy", healthy: true };
    }

    const mockRegistry = {
      getHealth() {
        return mockRecord;
      },
    };

    const results = evaluateSovereignReleaseGates({
      serviceRegistry: mockRegistry,
      coreHubArtifactCount: 15,
    });

    const healthGate = results.find((g) => g.gate === "microkernel_health");
    expect(healthGate?.passed).toBe(true);
  });

  it("passes when inspected via activeServices parameter", () => {
    const active = REQUIRED_MICROKERNEL_SERVICES.map((name) => ({
      name,
      healthy: true,
      status: "healthy",
    }));

    const results = evaluateSovereignReleaseGates({
      activeServices: active,
      coreHubArtifactCount: 15,
    });

    const healthGate = results.find((g) => g.gate === "microkernel_health");
    expect(healthGate?.passed).toBe(true);
  });

  it("detects and flags failure when any required service is missing", () => {
    // Exclude 'pr-workflow-orchestrator'
    const partialServices = REQUIRED_MICROKERNEL_SERVICES.filter(
      (s) => s !== "pr-workflow-orchestrator",
    );

    const results = evaluateSovereignReleaseGates({
      microkernelServices: partialServices,
      coreHubArtifactCount: 15,
    });

    const healthGate = results.find((g) => g.gate === "microkernel_health");
    expect(healthGate?.passed).toBe(false);
    expect(healthGate?.violations).toBeDefined();
    expect(healthGate?.violations?.some((v) => v.includes("pr-workflow-orchestrator"))).toBe(true);
    expect(healthGate?.summary).toContain("1 service violation(s) detected");
  });

  it("detects and flags failure when a required service has healthy === false", () => {
    const serviceObjects = REQUIRED_MICROKERNEL_SERVICES.map((name) => ({
      name,
      healthy: name !== "cory-memory",
      status: name === "cory-memory" ? "degraded" : "healthy",
      detail: name === "cory-memory" ? "Vector index corrupted" : "Normal",
    }));

    const results = evaluateSovereignReleaseGates({
      microkernelServices: serviceObjects,
      coreHubArtifactCount: 15,
    });

    const healthGate = results.find((g) => g.gate === "microkernel_health");
    expect(healthGate?.passed).toBe(false);
    expect(healthGate?.violations?.some((v) => v.includes("cory-memory"))).toBe(true);
  });

  it("detects and flags failure when a required service status is stopped/down", () => {
    const serviceObjects = REQUIRED_MICROKERNEL_SERVICES.map((name) => ({
      name,
      status: name === "browser-runtime" ? "down" : "healthy",
    }));

    const results = evaluateSovereignReleaseGates({
      microkernelServices: serviceObjects,
      coreHubArtifactCount: 15,
    });

    const healthGate = results.find((g) => g.gate === "microkernel_health");
    expect(healthGate?.passed).toBe(false);
    expect(healthGate?.violations?.some((v) => v.includes("browser-runtime"))).toBe(true);
  });

  it("aggregates multiple missing and unhealthy services", () => {
    const serviceObjects = [
      { name: "provider-runtime", healthy: true, status: "healthy" },
      { name: "rag-runtime", healthy: false, status: "down" },
    ];

    const results = evaluateSovereignReleaseGates({
      microkernelServices: serviceObjects,
      coreHubArtifactCount: 15,
    });

    const healthGate = results.find((g) => g.gate === "microkernel_health");
    expect(healthGate?.passed).toBe(false);
    // 1 unhealthy + 10 missing = 11 violations
    expect(healthGate?.violations).toHaveLength(11);
  });

  it("flags all 12 services when parameters are completely empty", () => {
    const results = evaluateSovereignReleaseGates({});
    const healthGate = results.find((g) => g.gate === "microkernel_health");
    expect(healthGate?.passed).toBe(false);
    expect(healthGate?.violations).toHaveLength(12);
  });
});

describe("evaluateSovereignReleaseGates - Private Artifact Exclusion Gate", () => {
  it("passes when staged files contain only public project assets", () => {
    const results = evaluateSovereignReleaseGates({
      ...createHealthyReleaseParams(),
    });

    const gate = results.find((g) => g.gate === "private_artifact_exclusion");
    expect(gate?.passed).toBe(true);
    expect(gate?.violations).toBeUndefined();
    expect(gate?.summary).toContain("Zero private artifacts detected");
  });

  it("detects and flags .env files in staged files", () => {
    const staged = ["src/index.ts", ".env", "docs/README.md"];
    const results = evaluateSovereignReleaseGates({
      stagedFilePaths: staged,
    });

    const gate = results.find((g) => g.gate === "private_artifact_exclusion");
    expect(gate?.passed).toBe(false);
    expect(gate?.violations?.some((v) => v.includes(".env"))).toBe(true);
  });

  it("detects and flags env variants like .env.local and .env.production", () => {
    const staged = [".env.local", "config/.env.production"];
    const results = evaluateSovereignReleaseGates({
      stagedFilePaths: staged,
    });

    const gate = results.find((g) => g.gate === "private_artifact_exclusion");
    expect(gate?.passed).toBe(false);
    expect(gate?.violations).toHaveLength(2);
  });

  it("detects and flags .git/info/exclude", () => {
    const staged = [".git/info/exclude"];
    const results = evaluateSovereignReleaseGates({
      stagedFilePaths: staged,
    });

    const gate = results.find((g) => g.gate === "private_artifact_exclusion");
    expect(gate?.passed).toBe(false);
    expect(gate?.violations?.some((v) => v.includes(".git/info/exclude"))).toBe(true);
  });

  it("detects and flags .evidence directory artifacts", () => {
    const staged = [".evidence/audit-run.json", ".evidence/test.log"];
    const results = evaluateSovereignReleaseGates({
      stagedFilePaths: staged,
    });

    const gate = results.find((g) => g.gate === "private_artifact_exclusion");
    expect(gate?.passed).toBe(false);
    expect(gate?.violations?.some((v) => v.includes(".evidence"))).toBe(true);
  });

  it("detects and flags .agents directory artifacts", () => {
    const staged = [".agents/handoff.md", ".agents/teamwork/plan.md"];
    const results = evaluateSovereignReleaseGates({
      stagedFilePaths: staged,
    });

    const gate = results.find((g) => g.gate === "private_artifact_exclusion");
    expect(gate?.passed).toBe(false);
    expect(gate?.violations?.some((v) => v.includes(".agents"))).toBe(true);
  });

  it("detects and flags ANTIGRAVITY internal documents", () => {
    const staged = ["docs/ANTIGRAVITY_STAGE9.md", "ANTIGRAVITY_NOTES.md"];
    const results = evaluateSovereignReleaseGates({
      stagedFilePaths: staged,
    });

    const gate = results.find((g) => g.gate === "private_artifact_exclusion");
    expect(gate?.passed).toBe(false);
    expect(gate?.violations).toHaveLength(2);
  });

  it("detects and flags private PRDs and ecosystem audit documents", () => {
    const staged = [
      "docs/COREBLOW_COMPREHENSIVE_AUDIT_REPORT.md",
      "docs/COREBLOW_ECOSYSTEM_26_REPOS.md",
      "docs/CORY_MEMORY_PRD.md",
      "docs/MICROKERNEL_HYBRID_UPGRADE_PRD.md",
      "docs/CORY_SKILL_EVOLUTION_PRD.md",
    ];

    const results = evaluateSovereignReleaseGates({
      stagedFilePaths: staged,
    });

    const gate = results.find((g) => g.gate === "private_artifact_exclusion");
    expect(gate?.passed).toBe(false);
    expect(gate?.violations).toHaveLength(5);
  });

  it("normalizes Windows backslashes in staged file paths correctly", () => {
    const staged = [
      "docs\\ANTIGRAVITY_INTERNAL.md",
      ".agents\\teamwork\\worker\\handoff.md",
      "secrets\\.env",
    ];

    const results = evaluateSovereignReleaseGates({
      stagedFilePaths: staged,
    });

    const gate = results.find((g) => g.gate === "private_artifact_exclusion");
    expect(gate?.passed).toBe(false);
    expect(gate?.violations).toHaveLength(3);
  });
});

describe("evaluateSovereignReleaseGates - Brand Sovereignty Gate", () => {
  it("passes when source snippets contain only pure sovereign terminology", () => {
    const snippets = [
      "export const SYSTEM = 'CoreBlow Sovereign Agent-OS';",
      "import { createMicrokernelServiceRegistry } from './microkernel.js';",
      "function runCoryMemory() { return true; }",
    ];

    const results = evaluateSovereignReleaseGates({
      sourceSnippets: snippets,
      coreHubArtifactCount: 15,
    });

    const gate = results.find((g) => g.gate === "brand_sovereignty");
    expect(gate?.passed).toBe(true);
    expect(gate?.violations).toBeUndefined();
    expect(gate?.summary).toContain("zero forbidden tokens detected in 3 source snippet(s)");
  });

  it("detects and flags forbidden brand tokens dynamically synthesized via character codes", () => {
    const forbidden1 = synthesizeToken(TOKEN_1_CODES);
    const forbidden4 = synthesizeToken(TOKEN_4_CODES);

    const snippets = [
      `import { Channel } from '${forbidden1}/runtime';`,
      "export const valid = true;",
      `const legacyName = '${forbidden4}';`,
    ];

    const results = evaluateSovereignReleaseGates({
      sourceSnippets: snippets,
      coreHubArtifactCount: 15,
    });

    const gate = results.find((g) => g.gate === "brand_sovereignty");
    expect(gate?.passed).toBe(false);
    expect(gate?.violations).toBeDefined();
    expect(gate?.violations?.some((v) => v.includes("snippet #0"))).toBe(true);
    expect(gate?.violations?.some((v) => v.includes("snippet #2"))).toBe(true);
  });

  it("detects uppercase and mixed-case occurrences of forbidden brand tokens", () => {
    const upperToken = synthesizeToken(TOKEN_1_CODES).toUpperCase();
    const mixedToken =
      synthesizeToken(TOKEN_2_CODES).charAt(0).toUpperCase() +
      synthesizeToken(TOKEN_2_CODES).slice(1);

    const snippets = [
      `// Header comment referencing ${upperToken}`,
      `const configPrefix = "${mixedToken}_CONFIG";`,
    ];

    const results = evaluateSovereignReleaseGates({
      sourceSnippets: snippets,
      coreHubArtifactCount: 15,
    });

    const gate = results.find((g) => g.gate === "brand_sovereignty");
    expect(gate?.passed).toBe(false);
    expect(gate?.violations?.length).toBeGreaterThanOrEqual(2);
    expect(gate?.violations?.some((v) => v.includes("snippet #0"))).toBe(true);
    expect(gate?.violations?.some((v) => v.includes("snippet #1"))).toBe(true);
  });

  it("supports custom forbiddenBrandTokens parameter", () => {
    const customForbidden = ["legacy-system-x", "deprecated-vendor-y"];
    const snippets = [
      "const x = 'legacy-system-x-token';",
      "const z = 'coreblow-native';",
    ];

    const results = evaluateSovereignReleaseGates({
      sourceSnippets: snippets,
      forbiddenBrandTokens: customForbidden,
      coreHubArtifactCount: 15,
    });

    const gate = results.find((g) => g.gate === "brand_sovereignty");
    expect(gate?.passed).toBe(false);
    expect(gate?.violations?.some((v) => v.includes("snippet #0"))).toBe(true);
  });
});

describe("evaluateSovereignReleaseGates - Security Invariants Gate", () => {
  it("passes when source snippets contain zero leaked credentials", () => {
    const cleanSnippets = [
      "const apiKey = process.env.API_KEY || '';",
      "export function authenticate(token: string) { return Boolean(token); }",
    ];

    const results = evaluateSovereignReleaseGates({
      sourceSnippets: cleanSnippets,
      coreHubArtifactCount: 15,
    });

    const gate = results.find((g) => g.gate === "security_invariants");
    expect(gate?.passed).toBe(true);
    expect(gate?.violations).toBeUndefined();
    expect(gate?.summary).toContain("zero raw credentials or private keys detected");
  });

  it("detects and flags Anthropic API keys (sk-ant-...)", () => {
    const snippets = ["const key = 'sk-ant-api03-abcdef1234567890';"];
    const results = evaluateSovereignReleaseGates({
      sourceSnippets: snippets,
    });

    const gate = results.find((g) => g.gate === "security_invariants");
    expect(gate?.passed).toBe(false);
    expect(gate?.violations?.some((v) => v.includes("Anthropic API Key"))).toBe(true);
  });

  it("detects and flags OpenAI API keys (sk-... / sk-proj-...)", () => {
    const snippets = [
      "const standardKey = 'sk-1234567890abcdef1234567890';",
      "const projectKey = 'sk-proj-abcdef12345678901234567890';",
    ];
    const results = evaluateSovereignReleaseGates({
      sourceSnippets: snippets,
    });

    const gate = results.find((g) => g.gate === "security_invariants");
    expect(gate?.passed).toBe(false);
    expect(gate?.violations).toHaveLength(2);
    expect(gate?.violations?.some((v) => v.includes("OpenAI API Key"))).toBe(true);
  });

  it("detects and flags GitHub Personal Access Tokens (ghp_... and github_pat_...)", () => {
    const snippets = [
      "const token1 = 'ghp_abcdef12345678901234567890';",
      "const token2 = 'github_pat_11AAAAAAA_abcdef1234567890';",
    ];
    const results = evaluateSovereignReleaseGates({
      sourceSnippets: snippets,
    });

    const gate = results.find((g) => g.gate === "security_invariants");
    expect(gate?.passed).toBe(false);
    expect(gate?.violations?.some((v) => v.includes("GitHub Token"))).toBe(true);
  });

  it("detects and flags Slack bot tokens (xoxb-...)", () => {
    const snippets = ["const slackToken = 'xoxb-123456789-abcdefghijklmnop';"];
    const results = evaluateSovereignReleaseGates({
      sourceSnippets: snippets,
    });

    const gate = results.find((g) => g.gate === "security_invariants");
    expect(gate?.passed).toBe(false);
    expect(gate?.violations?.some((v) => v.includes("Slack Token"))).toBe(true);
  });

  it("detects and flags Google Cloud / Firebase API keys (AIza...)", () => {
    const snippets = ["const gApiKey = 'AIzaSyAbcdefghijklmnopqrstuv12345';"];
    const results = evaluateSovereignReleaseGates({
      sourceSnippets: snippets,
    });

    const gate = results.find((g) => g.gate === "security_invariants");
    expect(gate?.passed).toBe(false);
    expect(gate?.violations?.some((v) => v.includes("Google Cloud / Firebase API Key"))).toBe(true);
  });

  it("detects and flags raw private key blocks", () => {
    const snippets = [
      "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----",
      "const keyHeader = 'PRIVATE KEY';",
    ];
    const results = evaluateSovereignReleaseGates({
      sourceSnippets: snippets,
    });

    const gate = results.find((g) => g.gate === "security_invariants");
    expect(gate?.passed).toBe(false);
    expect(gate?.violations).toHaveLength(2);
    expect(gate?.violations?.some((v) => v.includes("Private Key"))).toBe(true);
  });
});

describe("evaluateSovereignReleaseGates - CoreHub Catalog Integrity Gate", () => {
  it("passes when coreHubArtifactCount meets minimum threshold of 15", () => {
    const results = evaluateSovereignReleaseGates({
      coreHubArtifactCount: 15,
      microkernelServices: REQUIRED_MICROKERNEL_SERVICES,
    });

    const gate = results.find((g) => g.gate === "corehub_catalog_integrity");
    expect(gate?.passed).toBe(true);
    expect(gate?.summary).toContain("15 verified artifacts (minimum required: 15)");
  });

  it("passes with higher artifact counts (e.g. 25)", () => {
    const results = evaluateSovereignReleaseGates({
      coreHubArtifactCount: 25,
      microkernelServices: REQUIRED_MICROKERNEL_SERVICES,
    });

    const gate = results.find((g) => g.gate === "corehub_catalog_integrity");
    expect(gate?.passed).toBe(true);
    expect(gate?.summary).toContain("25 verified artifacts");
  });

  it("fails when coreHubArtifactCount is below threshold (boundary: 14)", () => {
    const results = evaluateSovereignReleaseGates({
      coreHubArtifactCount: 14,
    });

    const gate = results.find((g) => g.gate === "corehub_catalog_integrity");
    expect(gate?.passed).toBe(false);
    expect(gate?.violations?.some((v) => v.includes("below required minimum threshold of 15"))).toBe(true);
  });

  it("fails when coreHubArtifactCount is 0 or undefined", () => {
    const resultsZero = evaluateSovereignReleaseGates({ coreHubArtifactCount: 0 });
    const gateZero = resultsZero.find((g) => g.gate === "corehub_catalog_integrity");
    expect(gateZero?.passed).toBe(false);

    const resultsUndefined = evaluateSovereignReleaseGates({});
    const gateUndefined = resultsUndefined.find((g) => g.gate === "corehub_catalog_integrity");
    expect(gateUndefined?.passed).toBe(false);
  });
});

describe("toCanonicalJson Serialization", () => {
  it("serializes primitives identically to JSON.stringify", () => {
    expect(toCanonicalJson(null)).toBe("null");
    expect(toCanonicalJson(123)).toBe("123");
    expect(toCanonicalJson("coreblow")).toBe('"coreblow"');
    expect(toCanonicalJson(true)).toBe("true");
    expect(toCanonicalJson(false)).toBe("false");
  });

  it("sorts object keys alphabetically regardless of insertion order", () => {
    const objA = { b: 2, a: 1, c: 3 };
    const objB = { c: 3, a: 1, b: 2 };

    const jsonA = toCanonicalJson(objA);
    const jsonB = toCanonicalJson(objB);

    expect(jsonA).toBe('{"a":1,"b":2,"c":3}');
    expect(jsonA).toBe(jsonB);
  });

  it("recursively sorts keys in nested objects", () => {
    const nested1 = {
      z: { y: 2, x: 1 },
      a: { c: 3, b: 2 },
    };
    const nested2 = {
      a: { b: 2, c: 3 },
      z: { x: 1, y: 2 },
    };

    expect(toCanonicalJson(nested1)).toBe(toCanonicalJson(nested2));
    expect(toCanonicalJson(nested1)).toBe('{"a":{"b":2,"c":3},"z":{"x":1,"y":2}}');
  });

  it("preserves array order while sorting nested objects inside arrays", () => {
    const arr = [
      { beta: 2, alpha: 1 },
      { delta: 4, gamma: 3 },
    ];

    expect(toCanonicalJson(arr)).toBe('[{"alpha":1,"beta":2},{"delta":4,"gamma":3}]');
  });

  it("skips undefined object properties", () => {
    const obj = { a: 1, b: undefined, c: 3 };
    expect(toCanonicalJson(obj)).toBe('{"a":1,"c":3}');
  });
});

describe("compileSovereignReleaseManifest Determinism & Cryptographic Signing", () => {
  it("compiles a 100% passing v2.0.0 GA manifest when all 12 services and gates pass", () => {
    const params = createHealthyReleaseParams();
    const manifest = compileSovereignReleaseManifest(params);

    expect(manifest.product).toBe("CoreBlow Sovereign Agent-OS");
    expect(manifest.version).toBe("2.0.0");
    expect(manifest.releaseChannel).toBe("stable");
    expect(manifest.totalKernelServices).toBe(12);
    expect(manifest.kernelServiceNames).toEqual(REQUIRED_MICROKERNEL_SERVICES);
    expect(manifest.allGatesPassed).toBe(true);
    expect(manifest.gateResults).toHaveLength(5);
    expect(manifest.gateResults.every((g) => g.passed)).toBe(true);
    expect(manifest.manifestSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(typeof manifest.generatedAtMs).toBe("number");
  });

  it("produces deterministic SHA-256 hashes across repeated calls with identical parameters", () => {
    const params = createHealthyReleaseParams();

    const manifestA = compileSovereignReleaseManifest(params);
    const manifestB = compileSovereignReleaseManifest(params);

    expect(manifestA.manifestSha256).toBe(manifestB.manifestSha256);
    expect(manifestA.manifestSha256).toHaveLength(64);
  });

  it("manifestSha256 is immune to generatedAtMs variations (clock independent digest)", () => {
    const params = createHealthyReleaseParams();

    const manifestNow = compileSovereignReleaseManifest({
      ...params,
      generatedAtMs: 1000000000,
    });
    const manifestLater = compileSovereignReleaseManifest({
      ...params,
      generatedAtMs: 2000000000,
    });

    expect(manifestNow.generatedAtMs).toBe(1000000000);
    expect(manifestLater.generatedAtMs).toBe(2000000000);
    expect(manifestNow.manifestSha256).toBe(manifestLater.manifestSha256);
  });

  it("alters manifestSha256 if version or releaseChannel is modified", () => {
    const params = createHealthyReleaseParams();

    const manifestBase = compileSovereignReleaseManifest(params);
    const manifestCustomVersion = compileSovereignReleaseManifest({
      ...params,
      version: "2.1.0",
    });
    const manifestCustomChannel = compileSovereignReleaseManifest({
      ...params,
      releaseChannel: "canary",
    });

    expect(manifestCustomVersion.manifestSha256).not.toBe(manifestBase.manifestSha256);
    expect(manifestCustomChannel.manifestSha256).not.toBe(manifestBase.manifestSha256);
  });

  it("alters manifestSha256 if any gate fails", () => {
    const healthyParams = createHealthyReleaseParams();
    const manifestHealthy = compileSovereignReleaseManifest(healthyParams);

    const failingParams = {
      ...healthyParams,
      coreHubArtifactCount: 2, // Fails catalog integrity
    };
    const manifestFailing = compileSovereignReleaseManifest(failingParams);

    expect(manifestFailing.allGatesPassed).toBe(false);
    expect(manifestFailing.manifestSha256).not.toBe(manifestHealthy.manifestSha256);
    expect(manifestFailing.manifestSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("supports passing pre-evaluated gateResults directly", () => {
    const gateResults = evaluateSovereignReleaseGates(createHealthyReleaseParams());
    const manifest = compileSovereignReleaseManifest({
      gateResults,
      version: "2.0.0-rc1",
      releaseChannel: "rc",
    });

    expect(manifest.version).toBe("2.0.0-rc1");
    expect(manifest.releaseChannel).toBe("rc");
    expect(manifest.allGatesPassed).toBe(true);
    expect(manifest.gateResults).toEqual(gateResults);
  });
});
