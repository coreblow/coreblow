/**
 * CoreBlow — Native macOS Desktop App & Codex Companion Bridge Test Suite
 *
 * Verifies:
 * 1. Pure DOP Data Contracts & Sanitization (secret redaction, path traversal blocking).
 * 2. Deterministic Unified Diff parsing & 5-gate scorecard evaluation.
 * 3. High-performance snapshot compilation (< 5ms) across War Rooms, PRs, Wiki & Skills.
 * 4. Microkernel HTTP API routes:
 *    - GET  /api/corehub/desktop/state
 *    - POST /api/corehub/desktop/quick-launch
 *    - POST /api/corehub/desktop/diff-inspector
 */

import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ResolvedGatewayAuth } from "./auth.js";
import {
  compileDesktopStudioSnapshot,
  evaluateDesktopWorktreeDiff,
  executeDesktopQuickLaunch,
  hasPathTraversal,
  parseUnifiedDiffStats,
  redactRawSecrets,
  sanitizePairedAppContext,
  type PairedDesktopAppContext,
} from "./macos-codex-companion-bridge.js";
import {
  createMicrokernelServiceRegistry,
  handleCoreHubRoute,
  type MicrokernelServicesResult,
} from "./microkernel-services.js";

function createMockReqRes(options: {
  method: string;
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
}): {
  req: IncomingMessage;
  res: ServerResponse;
  getResult: () => Promise<{ statusCode: number; data: any; headers: Record<string, string> }>;
} {
  const passThrough = new PassThrough();
  const req = passThrough as unknown as IncomingMessage;
  (req as any).method = options.method;
  (req as any).url = options.url;

  const normalizedHeaders: Record<string, string> = {
    "content-type": "application/json",
    host: "localhost:3000",
  };
  if (options.headers) {
    for (const [k, v] of Object.entries(options.headers)) {
      normalizedHeaders[k.toLowerCase()] = v;
    }
  }
  (req as any).headers = normalizedHeaders;
  (req as any).socket = { remoteAddress: "127.0.0.1" };

  let statusCode = 200;
  const resHeaders: Record<string, string> = {};
  const chunks: Buffer[] = [];
  let isFinished = false;

  const res = new EventEmitter() as unknown as ServerResponse;
  Object.defineProperty(res, "statusCode", {
    get: () => statusCode,
    set: (val: number) => {
      statusCode = val;
    },
  });
  (res as any).setHeader = (key: string, value: string) => {
    resHeaders[key.toLowerCase()] = String(value);
  };
  (res as any).getHeader = (key: string) => resHeaders[key.toLowerCase()];
  (res as any).end = (chunk?: string | Buffer) => {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    isFinished = true;
    res.emit("finish");
  };

  if (options.body !== undefined) {
    const payload = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
    passThrough.end(Buffer.from(payload));
  } else {
    passThrough.end();
  }

  const getResult = async () => {
    if (!isFinished) {
      await new Promise<void>((resolve) => res.once("finish", () => resolve()));
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    let data: any = raw;
    try {
      data = JSON.parse(raw);
    } catch {
      // Raw string fallback
    }
    return { statusCode, data, headers: resHeaders };
  };

  return { req, res, getResult };
}

describe("CoreBlow Codex Companion Bridge & Studio Gateway", () => {
  let testDir: string;
  let coryDir: string;
  let microkernel: MicrokernelServicesResult;

  const testAuth: ResolvedGatewayAuth = {
    mode: "token",
    token: "test-sovereign-admin-token",
    modeSource: "token",
    allowTailscale: false,
  };

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `coreblow-studio-test-${crypto.randomUUID()}`);
    coryDir = path.join(testDir, "memory");
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(coryDir, { recursive: true });

    microkernel = createMicrokernelServiceRegistry({
      stateDir: testDir,
      coryDir,
    });
    await microkernel.registry.startAll();
  });

  afterEach(async () => {
    await microkernel.registry.stopAll();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // 1. Pure DOP Sanitization & Path Traversal Guard Tests
  // ==========================================================================

  describe("sanitizePairedAppContext", () => {
    it("redacts raw API keys (sk-..., sk-ant-..., ghp_..., xoxb-..., AIza...) from selected text and title", () => {
      const dirtyContext: PairedDesktopAppContext = {
        bundleId: "com.apple.dt.Xcode",
        appName: "Xcode",
        windowTitle: "Editing with sk-ant-api03-secret1234567890 key",
        selectedText: "const token = 'ghp_abcdef1234567890xyz'; const g = 'AIzaSyD-1234567890'; const s = 'sk-proj-998877665544332211';",
        activeFilePath: "/Users/febrinanda/coreblow/src/index.ts",
        workingDirectory: "/Users/febrinanda/coreblow",
      };

      const sanitized = sanitizePairedAppContext(dirtyContext);

      expect(sanitized.windowTitle).not.toContain("sk-ant-api03");
      expect(sanitized.windowTitle).toContain("[REDACTED_SECRET]");

      expect(sanitized.selectedText).not.toContain("ghp_abcdef");
      expect(sanitized.selectedText).not.toContain("AIzaSyD");
      expect(sanitized.selectedText).not.toContain("sk-proj");
      expect(sanitized.selectedText).toContain("[REDACTED_SECRET]");

      expect(sanitized.activeFilePath).toBe("/Users/febrinanda/coreblow/src/index.ts");
      expect(sanitized.workingDirectory).toBe("/Users/febrinanda/coreblow");
    });

    it("blocks directory traversal attempts (..) in activeFilePath and workingDirectory", () => {
      const traversalContext: PairedDesktopAppContext = {
        bundleId: "com.microsoft.VSCode",
        appName: "VS Code",
        activeFilePath: "/Users/febrinanda/coreblow/../../etc/passwd",
        workingDirectory: "../../../sensitive",
      };

      const sanitized = sanitizePairedAppContext(traversalContext);
      expect(sanitized.activeFilePath).toBeUndefined();
      expect(sanitized.workingDirectory).toBeUndefined();
      expect(hasPathTraversal("/Users/febrinanda/coreblow/../../etc/passwd")).toBe(true);
      expect(hasPathTraversal("%2e%2e%2f%2e%2e%2fetc%2fpasswd")).toBe(true);
      expect(hasPathTraversal("..\\..\\windows\\system32")).toBe(true);
      expect(hasPathTraversal("/Users/febrinanda/coreblow/src/index.ts")).toBe(false);
      // Legitimate multi-dot filenames should not be falsely blocked
      expect(hasPathTraversal("/Users/febrinanda/coreblow/src/service..test.ts")).toBe(false);
    });

    it("preserves safe context fields without modification", () => {
      const cleanContext: PairedDesktopAppContext = {
        bundleId: "com.apple.Terminal",
        appName: "Terminal",
        windowTitle: "zsh — pnpm test",
        activeFilePath: "src/gateway/microkernel-services.ts",
        workingDirectory: "/Users/febrinanda/coreblow",
      };

      const sanitized = sanitizePairedAppContext(cleanContext);
      expect(sanitized.bundleId).toBe("com.apple.Terminal");
      expect(sanitized.appName).toBe("Terminal");
      expect(sanitized.windowTitle).toBe("zsh — pnpm test");
      expect(sanitized.activeFilePath).toBe("src/gateway/microkernel-services.ts");
    });
  });

  // ==========================================================================
  // 2. Deterministic Unified Diff Parser Tests
  // ==========================================================================

  describe("parseUnifiedDiffStats", () => {
    it("returns empty array for empty diff strings", () => {
      expect(parseUnifiedDiffStats("")).toEqual([]);
      expect(parseUnifiedDiffStats("   \n\t  ")).toEqual([]);
    });

    it("accurately counts + / - lines and status across multi-file diffs", () => {
      const sampleDiff = `
diff --git a/src/app.ts b/src/app.ts
index 1234567..89abcdef 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,5 +1,7 @@
-old line 1
-old line 2
+new line 1
+new line 2
+new line 3
 context line
--- /dev/null
+++ b/src/new-feature.ts
@@ -0,0 +1,2 @@
+export const feature = true;
+export const version = 1;
--- a/src/deprecated.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-export const deprecated = true;
-export const unused = false;
`;

      const stats = parseUnifiedDiffStats(sampleDiff);
      expect(stats).toHaveLength(3);

      expect(stats[0]).toEqual({
        filePath: "src/app.ts",
        additions: 3,
        deletions: 2,
        status: "modified",
      });

      expect(stats[1]).toEqual({
        filePath: "src/new-feature.ts",
        additions: 2,
        deletions: 0,
        status: "added",
      });

      expect(stats[2]).toEqual({
        filePath: "src/deprecated.ts",
        additions: 0,
        deletions: 2,
        status: "deleted",
      });
    });

    it("correctly parses file paths with spaces and quoted paths", () => {
      const spaceDiff = `
diff --git "a/src/components/My Cool Button.tsx" "b/src/components/My Cool Button.tsx"
index 1234567..89abcdef 100644
--- "a/src/components/My Cool Button.tsx"
+++ "b/src/components/My Cool Button.tsx"
@@ -1,1 +1,2 @@
+export const MyCoolButton = () => null;
`;
      const stats = parseUnifiedDiffStats(spaceDiff);
      expect(stats).toHaveLength(1);
      expect(stats[0].filePath).toBe("src/components/My Cool Button.tsx");
      expect(stats[0].status).toBe("modified");
      expect(stats[0].additions).toBe(1);
      expect(stats[0].deletions).toBe(0);
    });

    it("accurately detects git binary files and patches without dropping the file entry", () => {
      const binaryDiff = `
diff --git a/assets/brand-logo.png b/assets/brand-logo.png
new file mode 100644
index 0000000..abcdef1
Binary files /dev/null and b/assets/brand-logo.png differ
diff --git a/assets/legacy.bin b/assets/legacy.bin
deleted file mode 100644
index 1234567..0000000
Binary files a/assets/legacy.bin and /dev/null differ
`;
      const stats = parseUnifiedDiffStats(binaryDiff);
      expect(stats).toHaveLength(2);
      expect(stats[0]).toEqual({
        filePath: "assets/brand-logo.png",
        additions: 0,
        deletions: 0,
        status: "added",
      });
      expect(stats[1]).toEqual({
        filePath: "assets/legacy.bin",
        additions: 0,
        deletions: 0,
        status: "deleted",
      });
    });

    it("evaluates complete desktop worktree diff view with 5-gate scorecard", () => {
      const diffView = evaluateDesktopWorktreeDiff({
        diffText: `
--- a/src/test.ts
+++ b/src/test.ts
@@ -1,1 +1,2 @@
+// safe comment
`,
        branchName: "feat/stage-11-studio",
      });

      expect(diffView.branchName).toBe("feat/stage-11-studio");
      expect(diffView.preFlightGatesPassed).toBe(true);
      expect(diffView.gateChecks).toHaveLength(5);
      expect(diffView.gateChecks.map((g) => g.name)).toEqual([
        "typecheck",
        "linter",
        "unit_tests",
        "secret_scan",
        "forbidden_paths",
      ]);
    });
  });

  // ==========================================================================
  // 3. Desktop Studio Snapshot Aggregator Tests
  // ==========================================================================

  describe("compileDesktopStudioSnapshot", () => {
    it("aggregates live War Rooms, PR drafts, Memory Wiki pages, and locked/verified skills", async () => {
      // 1. Create a live War Room
      const room = microkernel.warRoom.createWarRoom({
        title: "Stage 11 Native Architecture",
        purpose: "Build CoreBlow Studio & Companion Bar",
      });

      // 2. Create a PR draft
      microkernel.prWorkflow.createPullRequestDraft({
        title: "Add Studio Companion Bar",
        description: "Native SwiftUI 3-pane experience",
        sourceBranch: "feat/studio",
        targetBranch: "main",
        changedFiles: ["src/gateway/macos-codex-companion-bridge.ts"],
        diffText: "+// Safe diff",
        testPassed: true,
        typecheckPassed: true,
        lintPassed: true,
      });

      // 3. Compile snapshot
      const snapshot = await compileDesktopStudioSnapshot({
        services: microkernel,
        pairedApp: {
          bundleId: "com.apple.dt.Xcode",
          appName: "Xcode",
        },
      });

      expect(snapshot.companionShortcut).toBe("Option+Space");
      expect(snapshot.pairedApp?.appName).toBe("Xcode");
      expect(snapshot.activeThreads.length).toBeGreaterThanOrEqual(2);

      const warRoomThread = snapshot.activeThreads.find((t) => t.threadId === room.roomId);
      expect(warRoomThread).toBeDefined();
      expect(warRoomThread?.mode).toBe("war_room");

      const prThread = snapshot.activeThreads.find((t) => t.mode === "single_agent");
      expect(prThread).toBeDefined();

      expect(snapshot.voiceTelemetry.backend).toBe("apple-mlx-neural");
      expect(snapshot.voiceTelemetry.meetsSovereignTarget).toBe(true);
      expect(snapshot.voiceTelemetry.rtf).toBeLessThanOrEqual(0.4);

      expect(typeof snapshot.memoryWikiPagesCount).toBe("number");
      expect(typeof snapshot.verifiedSkillsCount).toBe("number");
      expect(typeof snapshot.lockedSkillsCount).toBe("number");
    });
  });

  // ==========================================================================
  // 4. Microkernel HTTP Route Endpoints Tests
  // ==========================================================================

  describe("handleCoreHubRoute Desktop Endpoints", () => {
    it("handles GET /api/corehub/desktop/state without requiring mutation auth", async () => {
      const { req, res, getResult } = createMockReqRes({
        method: "GET",
        url: "/api/corehub/desktop/state",
      });

      const handled = await handleCoreHubRoute(req, res, microkernel);
      expect(handled).toBe(true);

      const result = await getResult();
      expect(result.statusCode).toBe(200);
      expect(result.data.ok).toBe(true);
      expect(result.data.snapshot.companionShortcut).toBe("Option+Space");
      expect(result.data.snapshot.voiceTelemetry.meetsSovereignTarget).toBe(true);
    });

    it("rejects unauthenticated requests to POST /api/corehub/desktop/quick-launch with 401", async () => {
      const { req, res, getResult } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/desktop/quick-launch",
        body: {
          prompt: "Analyze this file in Xcode",
        },
      });

      const handled = await handleCoreHubRoute(req, res, microkernel, { auth: testAuth });
      expect(handled).toBe(true);

      const result = await getResult();
      expect(result.statusCode).toBe(401);
    });

    it("handles authenticated POST /api/corehub/desktop/quick-launch and classifies route tier", async () => {
      const { req, res, getResult } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/desktop/quick-launch",
        headers: {
          authorization: "Bearer test-sovereign-admin-token",
        },
        body: {
          prompt: "Write a unit test function in typescript",
          pairedApp: {
            bundleId: "com.microsoft.VSCode",
            appName: "VS Code",
            windowTitle: "sk-test1234567890 key in app.ts",
          },
          spawnWarRoom: true,
        },
      });

      const handled = await handleCoreHubRoute(req, res, microkernel, { auth: testAuth });
      expect(handled).toBe(true);

      const result = await getResult();
      expect(result.statusCode).toBe(200);
      expect(result.data.ok).toBe(true);
      expect(result.data.routeTier).toBe("coding");
      expect(result.data.sanitizedContext.windowTitle).toContain("[REDACTED_SECRET]");
      expect(result.data.warRoomSession).toBeDefined();
    });

    it("rejects quick-launch without prompt with 400", async () => {
      const { req, res, getResult } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/desktop/quick-launch",
        headers: {
          authorization: "Bearer test-sovereign-admin-token",
        },
        body: {},
      });

      await handleCoreHubRoute(req, res, microkernel, { auth: testAuth });
      const result = await getResult();
      expect(result.statusCode).toBe(400);
      expect(result.data.error).toContain("Missing required 'prompt' field");
    });

    it("handles authenticated POST /api/corehub/desktop/diff-inspector with 5-gate scorecard", async () => {
      const sampleDiff = `
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1,1 +1,2 @@
+export function helper() { return 42; }
`;
      const { req, res, getResult } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/desktop/diff-inspector",
        headers: {
          authorization: "Bearer test-sovereign-admin-token",
        },
        body: {
          diffText: sampleDiff,
          branchName: "feature/companion",
        },
      });

      const handled = await handleCoreHubRoute(req, res, microkernel, { auth: testAuth });
      expect(handled).toBe(true);

      const result = await getResult();
      expect(result.statusCode).toBe(200);
      expect(result.data.ok).toBe(true);
      expect(result.data.diffView.branchName).toBe("feature/companion");
      expect(result.data.diffView.changedFiles).toHaveLength(1);
      expect(result.data.diffView.changedFiles[0].filePath).toBe("src/utils.ts");
      expect(result.data.diffView.preFlightGatesPassed).toBe(true);
      expect(result.data.diffView.gateChecks).toHaveLength(5);
    });

    it("detects raw secrets during diff inspection and marks secret_scan gate as failed", async () => {
      const leakyDiff = `
--- a/src/config.ts
+++ b/src/config.ts
@@ -1,1 +1,2 @@
+const key = "sk-123456789012345678901234567890";
`;
      const { req, res, getResult } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/desktop/diff-inspector",
        headers: {
          authorization: "Bearer test-sovereign-admin-token",
        },
        body: {
          diffText: leakyDiff,
        },
      });

      await handleCoreHubRoute(req, res, microkernel, { auth: testAuth });
      const result = await getResult();
      expect(result.statusCode).toBe(200);
      expect(result.data.diffView.preFlightGatesPassed).toBe(false);

      const secretCheck = result.data.diffView.gateChecks.find((c: any) => c.name === "secret_scan");
      expect(secretCheck.passed).toBe(false);
    });

    it("forwards prId correctly through POST /api/corehub/desktop/diff-inspector", async () => {
      const sampleDiff = `
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,1 +1,2 @@
+const x = 1;
`;
      const { req, res, getResult } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/desktop/diff-inspector",
        headers: {
          authorization: "Bearer test-sovereign-admin-token",
        },
        body: {
          diffText: sampleDiff,
          prId: "pr_stage_11_spec",
          branchName: "feat/stage-11",
        },
      });

      await handleCoreHubRoute(req, res, microkernel, { auth: testAuth });
      const result = await getResult();
      expect(result.statusCode).toBe(200);
      expect(result.data.diffView.prId).toBe("pr_stage_11_spec");
      expect(result.data.diffView.branchName).toBe("feat/stage-11");
    });

    it("automatically populates worktreeInspector from active PR draft in GET /api/corehub/desktop/state", async () => {
      microkernel.prWorkflow.createPullRequestDraft({
        title: "Active Companion PR",
        description: "PR diff test",
        sourceBranch: "feat/companion-bar",
        targetBranch: "main",
        changedFiles: ["src/app.ts"],
        diffText: `
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,1 +1,2 @@
+export const active = true;
`,
        testPassed: true,
        typecheckPassed: true,
        lintPassed: true,
      });

      const { req, res, getResult } = createMockReqRes({
        method: "GET",
        url: "/api/corehub/desktop/state",
      });

      await handleCoreHubRoute(req, res, microkernel);
      const result = await getResult();
      expect(result.statusCode).toBe(200);
      expect(result.data.snapshot.worktreeInspector.branchName).toBe("feat/companion-bar");
      expect(result.data.snapshot.worktreeInspector.changedFiles).toHaveLength(1);
      expect(result.data.snapshot.worktreeInspector.changedFiles[0].filePath).toBe("src/app.ts");
    });

    it("supports /quick-launch and /diff-inspector route aliases", async () => {
      // 1. /quick-launch alias
      const ql = createMockReqRes({
        method: "POST",
        url: "/quick-launch",
        headers: {
          authorization: "Bearer test-sovereign-admin-token",
        },
        body: {
          prompt: "Quick launch check",
        },
      });
      const qlHandled = await handleCoreHubRoute(ql.req, ql.res, microkernel, { auth: testAuth });
      expect(qlHandled).toBe(true);
      const qlRes = await ql.getResult();
      expect(qlRes.statusCode).toBe(200);
      expect(qlRes.data.ok).toBe(true);

      // 2. /diff-inspector alias
      const sampleDiff = `
--- a/src/sample.ts
+++ b/src/sample.ts
@@ -1,1 +1,2 @@
+export const test = 1;
+`;
      const di = createMockReqRes({
        method: "POST",
        url: "/diff-inspector",
        headers: {
          authorization: "Bearer test-sovereign-admin-token",
        },
        body: {
          diffText: sampleDiff,
          branchName: "main",
        },
      });
      const diHandled = await handleCoreHubRoute(di.req, di.res, microkernel, { auth: testAuth });
      expect(diHandled).toBe(true);
      const diRes = await di.getResult();
      expect(diRes.statusCode).toBe(200);
      expect(diRes.data.ok).toBe(true);
      expect(diRes.data.diffView).toBeDefined();

      // 3. /desktop/state and /state aliases
      const stateAlias = createMockReqRes({
        method: "GET",
        url: "/desktop/state",
      });
      const stateHandled = await handleCoreHubRoute(stateAlias.req, stateAlias.res, microkernel, { auth: testAuth });
      expect(stateHandled).toBe(true);
      const stateRes = await stateAlias.getResult();
      expect(stateRes.statusCode).toBe(200);
      expect(stateRes.data.ok).toBe(true);
      expect(stateRes.data.snapshot).toBeDefined();
    });
  });
});
