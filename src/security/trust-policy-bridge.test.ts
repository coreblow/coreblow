import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runSecurityAudit } from "./audit.js";
import {
  evaluateTrustPolicyForAudit,
  resolveCoreBlowTrustBinary,
} from "./trust-policy-bridge.js";

const tempDirs: string[] = [];

function createTempStub(scriptBody: string, filename = "coreblow-trust"): { dir: string; binPath: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-trust-stub-"));
  tempDirs.push(dir);
  const binPath = path.join(dir, filename);
  fs.writeFileSync(binPath, `#!${process.execPath}\n${scriptBody}`, { mode: 0o755 });
  return { dir, binPath };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("trust-policy-bridge", () => {
  it("gracefully skips when coreblow-trust is absent on PATH", async () => {
    const env = { PATH: "" };
    expect(resolveCoreBlowTrustBinary(env, "linux")).toBeNull();

    const res = await evaluateTrustPolicyForAudit({
      cfg: {},
      findings: [],
      env,
      platform: "linux",
    });

    expect(res.summary.status).toBe("skipped");
    expect(res.summary.reason).toContain("not installed on PATH");
    expect(res.findings).toHaveLength(1);
    expect(res.findings[0]?.checkId).toBe("trust.policy_bundle.skipped");
    expect(res.findings[0]?.severity).toBe("info");
  });

  it("discovers coreblow-trust on PATH and parses passing evaluation", async () => {
    const { dir } = createTempStub(`
const args = process.argv.slice(2);
if (args.includes("--bundle-info")) {
  console.log(JSON.stringify({
    product: "CoreBlow",
    framework: "OWASP Top 10 for Agentic AI",
    version: "1.2.0",
    ruleCount: 10
  }));
  process.exit(0);
}
console.log(JSON.stringify({
  pass: true,
  framework: "OWASP Top 10 for Agentic AI",
  bundleVersion: "1.2.0",
  totalRules: 10,
  highestSeverity: "none",
  violationCount: 0,
  findings: []
}));
process.exit(0);
`);

    const env = { PATH: dir };
    const resolved = resolveCoreBlowTrustBinary(env, "linux");
    expect(resolved).toBe(path.join(dir, "coreblow-trust"));

    const res = await evaluateTrustPolicyForAudit({
      cfg: { gateway: { mode: "local" } },
      findings: [],
      env,
      platform: "linux",
    });

    expect(res.summary).toMatchObject({
      status: "evaluated",
      framework: "OWASP Top 10 for Agentic AI",
      bundleVersion: "1.2.0",
      ruleCount: 10,
      pass: true,
      violationCount: 0,
    });
    expect(res.findings).toHaveLength(1);
    expect(res.findings[0]?.checkId).toBe("trust.policy_bundle.evaluated");
    expect(res.findings[0]?.severity).toBe("info");
  });

  it("parses OWASP Agentic AI violations via COREBLOW_TRUST_BIN when exit code is 1", async () => {
    const { binPath } = createTempStub(`
const args = process.argv.slice(2);
if (args.includes("--bundle-info")) {
  console.log(JSON.stringify({
    product: "CoreBlow",
    framework: "OWASP Top 10 for Agentic AI",
    version: "1.2.0",
    ruleCount: 10
  }));
  process.exit(0);
}
console.log(JSON.stringify({
  pass: false,
  framework: "OWASP Top 10 for Agentic AI",
  bundleVersion: "1.2.0",
  totalRules: 10,
  highestSeverity: "critical",
  violationCount: 2,
  findings: [
    {
      id: "ASI01",
      category: "Agent Goal Hijack",
      severity: "critical",
      summary: "Prompt injection vector detected.",
      remediation: "Isolate untrusted tool outputs."
    },
    {
      id: "ASI02",
      category: "Tool Misuse",
      severity: "high",
      summary: "Unrestricted exec surface detected.",
      remediation: "Enforce exec allowlist."
    }
  ]
}));
process.exit(1);
`, "custom-trust-bin");

    const report = await runSecurityAudit({
      config: { gateway: { mode: "local" } },
      env: { COREBLOW_TRUST_BIN: binPath, PATH: "" },
      includeFilesystem: false,
      includeChannelSecurity: false,
    });

    expect(report.trustPolicy).toMatchObject({
      status: "evaluated",
      framework: "OWASP Top 10 for Agentic AI",
      bundleVersion: "1.2.0",
      ruleCount: 10,
      pass: false,
      highestSeverity: "critical",
      violationCount: 2,
    });

    const evalFinding = report.findings.find((f) => f.checkId === "trust.policy_bundle.evaluated");
    expect(evalFinding?.detail).toContain("2 violation(s)");

    const asi01 = report.findings.find((f) => f.checkId === "trust.owasp_agentic.asi01");
    expect(asi01?.severity).toBe("critical");
    expect(asi01?.title).toBe("[ASI01] Agent Goal Hijack");
    expect(asi01?.remediation).toBe("Isolate untrusted tool outputs.");

    const asi02 = report.findings.find((f) => f.checkId === "trust.owasp_agentic.asi02");
    expect(asi02?.severity).toBe("warn");
  });

  it("handles malformed JSON without crashing security audit", async () => {
    const { binPath } = createTempStub(`
console.log("not-valid-json{{{");
process.exit(0);
`);

    const res = await evaluateTrustPolicyForAudit({
      cfg: {},
      findings: [],
      env: { COREBLOW_TRUST_BIN: binPath, PATH: "" },
    });

    expect(res.summary.status).toBe("error");
    expect(res.summary.reason).toContain("malformed JSON");
    expect(res.findings[0]?.checkId).toBe("trust.policy_bundle.error");
    expect(res.findings[0]?.severity).toBe("info");
  });

  it("handles CLI timeout gracefully without crashing", async () => {
    const { binPath } = createTempStub(`
setTimeout(() => {}, 10000);
`);

    const res = await evaluateTrustPolicyForAudit({
      cfg: {},
      findings: [],
      env: { COREBLOW_TRUST_BIN: binPath, PATH: "" },
      timeoutMs: 80,
    });

    expect(res.summary.status).toBe("error");
    expect(res.summary.reason).toContain("timed out");
    expect(res.findings[0]?.checkId).toBe("trust.policy_bundle.error");
    expect(res.findings[0]?.severity).toBe("info");
  });
});
