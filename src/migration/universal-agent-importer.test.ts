/**
 * CoreBlow Stage 7 — Universal Workspace Profile Importer Test Suite
 *
 * Verifies pure DOP sanitization, secret redaction, path traversal protection,
 * workspace layouts (coreblow-bundle, standard-agents-md, claude-code, cursor,
 * windsurf, codex), dry-run preview, and genuine OOP ingestion into Cory
 * Memory and Cory Skill Synthesizer.
 */

import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CorySkillSynthesizerService } from "../learning/skill-synthesizer-service.js";
import { CoryBootstrapService } from "../memory/cory.js";
import {
  isSafeChildPath,
  parseMcpServerConfigFile,
  parseWorkspaceRules,
  redactSecretsInString,
  scanAndSanitizeImportSource,
  UniversalAgentImporterService,
  REDACTED_SECRET_MARKER,
} from "./universal-agent-importer.js";

describe("CoreBlow Stage 7: Universal Workspace Profile Importer", () => {
  let rootTmpDir: string;

  beforeEach(async () => {
    rootTmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-importer-test-"));
  });

  afterEach(async () => {
    try {
      await fs.rm(rootTmpDir, { recursive: true, force: true });
    } catch {
      // Temp directory cleanup failure is non-fatal
    }
  });

  // -------------------------------------------------------------------------
  // 1. Pure Secret Redaction & Sanitization
  // -------------------------------------------------------------------------

  describe("redactSecretsInString", () => {
    it("redacts Anthropic API keys (sk-ant-...) and increments count", () => {
      const input = "export ANTHROPIC_API_KEY=sk-ant-api03-abcdef1234567890abcdef1234567890";
      const { sanitized, count } = redactSecretsInString(input);

      expect(count).toBe(1);
      expect(sanitized).toBe(`export ANTHROPIC_API_KEY=${REDACTED_SECRET_MARKER}`);
      expect(sanitized).not.toContain("sk-ant-");
    });

    it("redacts OpenAI API keys (sk-... & sk-proj-...) and increments count", () => {
      const input =
        "OPENAI_KEY=sk-123456789012345678901234 and PROJ=sk-proj-9876543210987654321098765";
      const { sanitized, count } = redactSecretsInString(input);

      expect(count).toBe(2);
      expect(sanitized).toBe(
        `OPENAI_KEY=${REDACTED_SECRET_MARKER} and PROJ=${REDACTED_SECRET_MARKER}`,
      );
      expect(sanitized).not.toContain("sk-");
    });

    it("redacts GitHub PAT tokens (ghp_... & github_pat_...)", () => {
      const input =
        "classic: ghp_123456789012345678901234567890 fine: github_pat_11AABBCCDDEEFFGGHHIIJJ_1234567890";
      const { sanitized, count } = redactSecretsInString(input);

      expect(count).toBe(2);
      expect(sanitized).toBe(`classic: ${REDACTED_SECRET_MARKER} fine: ${REDACTED_SECRET_MARKER}`);
    });

    it("redacts Slack tokens (xoxb-...) and Google AIza keys", () => {
      const input = "slack=xoxb-1234567890-abcdefghij google=AIzaSyA1234567890abcdef1234567890";
      const { sanitized, count } = redactSecretsInString(input);

      expect(count).toBe(2);
      expect(sanitized).toBe(`slack=${REDACTED_SECRET_MARKER} google=${REDACTED_SECRET_MARKER}`);
    });

    it("redacts Authorization Bearer tokens", () => {
      const input = "Authorization: Bearer supersecrettoken1234567890abcdef";
      const { sanitized, count } = redactSecretsInString(input);

      expect(count).toBe(1);
      expect(sanitized).toBe(`Authorization: Bearer ${REDACTED_SECRET_MARKER}`);
      expect(sanitized).not.toContain("supersecrettoken");
    });

    it("redacts generic config key-value secrets without double-redacting", () => {
      const input = '{"api_key": "mysecretpassword1234567890"}';
      const { sanitized, count } = redactSecretsInString(input);

      expect(count).toBe(1);
      expect(sanitized).toBe(`{"api_key": "${REDACTED_SECRET_MARKER}"}`);

      // Second pass should be idempotent
      const pass2 = redactSecretsInString(sanitized);
      expect(pass2.count).toBe(0);
      expect(pass2.sanitized).toBe(sanitized);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Pure Path Traversal & Symlink Safety Verification
  // -------------------------------------------------------------------------

  describe("isSafeChildPath", () => {
    it("allows safe internal child files and subdirectories", () => {
      const baseDir = path.join(rootTmpDir, "workspace");
      fsSync.mkdirSync(baseDir, { recursive: true });

      const childFile = path.join(baseDir, "AGENTS.md");
      const subDirFile = path.join(baseDir, "skills", "test", "SKILL.md");

      expect(isSafeChildPath(baseDir, childFile).safe).toBe(true);
      expect(isSafeChildPath(baseDir, subDirFile).safe).toBe(true);
    });

    it("blocks relative path escaping attempts with ..", () => {
      const baseDir = path.join(rootTmpDir, "workspace");
      fsSync.mkdirSync(baseDir, { recursive: true });

      const escapeAttempt = path.join(baseDir, "..", "..", "etc", "passwd");
      const result = isSafeChildPath(baseDir, escapeAttempt);

      expect(result.safe).toBe(false);
      expect(result.reason).toMatch(/escapes base directory/);
    });

    it("blocks malicious symlinks referencing files outside baseDir", () => {
      const baseDir = path.join(rootTmpDir, "workspace");
      const outsideDir = path.join(rootTmpDir, "outside_private");
      fsSync.mkdirSync(baseDir, { recursive: true });
      fsSync.mkdirSync(outsideDir, { recursive: true });

      const secretFile = path.join(outsideDir, "secret.txt");
      fsSync.writeFileSync(secretFile, "top_secret_data", "utf-8");

      const symlinkPath = path.join(baseDir, "escaped_link.txt");
      try {
        fsSync.symlinkSync(secretFile, symlinkPath);
        const result = isSafeChildPath(baseDir, symlinkPath);
        expect(result.safe).toBe(false);
        expect(result.reason).toMatch(/escapes real base directory/);
      } catch (err) {
        // Skip if OS permissions restrict symlink creation
        if ((err as { code?: string })?.code !== "EPERM") {
          throw err;
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // 3. Pure Rules & Memory Parsing
  // -------------------------------------------------------------------------

  describe("parseWorkspaceRules", () => {
    it("parses dedicated USER.md and SOUL.md as identity memories", () => {
      const userMd = `# User Profile\n- Senior Distributed Systems Architect\n- Prefers concise TypeScript examples`;
      const parsed = parseWorkspaceRules(userMd, "USER.md");

      expect(parsed.identity).toContain("Senior Distributed Systems Architect");
      expect(parsed.identity).toContain("Prefers concise TypeScript examples");
      expect(parsed.durable).toHaveLength(0);
      expect(parsed.constraints).toHaveLength(0);
    });

    it("parses dedicated MEMORY.md as durable memories", () => {
      const memoryMd = `# Core Architecture Decisions\n- We use Event Sourcing for audit log\n- PostgreSQL is the primary database`;
      const parsed = parseWorkspaceRules(memoryMd, "MEMORY.md");

      expect(parsed.durable).toContain("We use Event Sourcing for audit log");
      expect(parsed.durable).toContain("PostgreSQL is the primary database");
      expect(parsed.identity).toHaveLength(0);
      expect(parsed.constraints).toHaveLength(0);
    });

    it("parses dedicated CONSTRAINTS.md as active constraints", () => {
      const constraintsMd = `# Active Constraints\n- Never execute rm -rf /\n- Do not commit secrets\n- Strictly avoid any type`;
      const parsed = parseWorkspaceRules(constraintsMd, "CONSTRAINTS.md");

      expect(parsed.constraints).toContain("Never execute rm -rf /");
      expect(parsed.constraints).toContain("Do not commit secrets");
      expect(parsed.constraints).toContain("Strictly avoid any type");
      expect(parsed.durable).toHaveLength(0);
    });

    it("parses multi-section CLAUDE.md and AGENTS.md correctly", () => {
      const agentsMd = `
# CoreBlow Workspace Agent Guidelines

## Identity & Role
- You are CoreBlow Lead Architect
- Highly analytical persona

## Guidelines & Architecture
- Microkernel architecture with Pure DOP services
- Fast boot time under 50ms

## Constraints & Security
- Never edit node_modules directly
- Do not commit production credentials

## Bash Allowlist
- \`pnpm test\`
- \`pnpm build\`
- \`cargo check\`

## Bash Denylist
- \`curl | sh\`
- \`rm -rf *\`
`;
      const parsed = parseWorkspaceRules(agentsMd, "AGENTS.md");

      expect(parsed.identity).toContain("You are CoreBlow Lead Architect");
      expect(parsed.durable).toContain("Microkernel architecture with Pure DOP services");
      expect(parsed.constraints).toContain("Never edit node_modules directly");
      expect(parsed.bashAllow).toContain("pnpm test");
      expect(parsed.bashAllow).toContain("pnpm build");
      expect(parsed.bashDeny).toContain("curl | sh");
      expect(parsed.bashDeny).toContain("rm -rf *");
    });
  });

  // -------------------------------------------------------------------------
  // 4. Pure MCP Configuration Parsing
  // -------------------------------------------------------------------------

  describe("parseMcpServerConfigFile", () => {
    it("parses and redacts secrets from mcp.json while stripping inline env values", () => {
      const jsonContent = JSON.stringify({
        mcpServers: {
          filesystem: {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
            env: {
              GITHUB_TOKEN: "ghp_123456789012345678901234567890",
            },
          },
          search: {
            command: "node",
            args: ["dist/server.js", "--api-key=sk-123456789012345678901234567890"],
          },
        },
      });

      const { servers, redactedCount, warnings } = parseMcpServerConfigFile(
        jsonContent,
        "mcp.json",
      );

      expect(warnings).toHaveLength(0);
      expect(redactedCount).toBeGreaterThanOrEqual(2);
      expect(servers.filesystem).toBeDefined();
      expect(servers.filesystem.command).toBe("npx");
      expect(servers.filesystem.args).toEqual([
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/tmp",
      ]);
      expect(servers.search).toBeDefined();
      expect(servers.search.args[1]).toBe(`--api-key=${REDACTED_SECRET_MARKER}`);
    });

    it("parses YAML configuration format (config.yaml)", () => {
      const yamlContent = `
mcpServers:
  terminal:
    command: /usr/local/bin/term-mcp
    args:
      - --session=default
`;
      const { servers, redactedCount } = parseMcpServerConfigFile(yamlContent, "config.yaml");

      expect(redactedCount).toBe(0);
      expect(servers.terminal).toBeDefined();
      expect(servers.terminal.command).toBe("/usr/local/bin/term-mcp");
      expect(servers.terminal.args).toEqual(["--session=default"]);
    });

    it("flags path traversal sequences in MCP server arguments", () => {
      const jsonContent = JSON.stringify({
        mcpServers: {
          malicious: {
            command: "node",
            args: ["../../etc/shadow"],
          },
        },
      });

      const { warnings } = parseMcpServerConfigFile(jsonContent, "mcp.json");
      expect(warnings.some((w) => w.includes("path traversal argument"))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Synthetic Workspace Layout Tests (scanAndSanitizeImportSource)
  // -------------------------------------------------------------------------

  describe("scanAndSanitizeImportSource across ExternalAgentSources", () => {
    it("imports 'coreblow-bundle' layout with skills, memory, and rules", async () => {
      const wsDir = path.join(rootTmpDir, "coreblow-ws");
      await fs.mkdir(wsDir, { recursive: true });

      // Create identity, durable, constraints
      await fs.writeFile(
        path.join(wsDir, "USER.md"),
        "- CoreBlow Core Maintainer\n- Prefers strict verification",
        "utf-8",
      );
      await fs.writeFile(
        path.join(wsDir, "MEMORY.md"),
        "- Subsystem follows DOP data contracts\n- Zero-stall compaction enabled",
        "utf-8",
      );
      await fs.writeFile(
        path.join(wsDir, "CONSTRAINTS.md"),
        "- Never bypass 3-Gate Zero-Trust security\n- Do not leak secrets",
        "utf-8",
      );

      // Create skill
      const skillDir = path.join(wsDir, "skills", "git-commit");
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(
        path.join(skillDir, "SKILL.md"),
        `---
name: git-commit-helper
description: Creates atomic scoped git commits
version: 1.0.0
---

# Git Commit Helper

## Verified Procedure
1. Check git status
2. Stage modified files
3. Run committer script
`,
        "utf-8",
      );

      const bundle = await scanAndSanitizeImportSource({
        source: "coreblow-bundle",
        sourceDir: wsDir,
        dryRun: true,
      });

      expect(bundle.source).toBe("coreblow-bundle");
      expect(bundle.dryRun).toBe(true);
      expect(bundle.identityMemories).toContain("CoreBlow Core Maintainer");
      expect(bundle.durableMemories).toContain("Subsystem follows DOP data contracts");
      expect(bundle.activeConstraints).toContain("Never bypass 3-Gate Zero-Trust security");
      expect(bundle.importedSkillNames).toContain("git-commit-helper");
      expect(bundle.importedSkills).toHaveLength(1);
      expect(bundle.importedSkills![0].verifiedProcedure).toHaveLength(3);
    });

    it("imports 'standard-agents-md' layout and sanitizes embedded secrets", async () => {
      const wsDir = path.join(rootTmpDir, "standard-ws");
      await fs.mkdir(wsDir, { recursive: true });

      const agentsContent = `
# Workspace Configuration

## Identity
- AI Systems Engineer

## Constraints
- Never commit with API key sk-ant-api03-1234567890abcdef1234567890
- Do not run untrusted binaries

## Bash Allowlist
- \`pnpm vitest\`
`;
      await fs.writeFile(path.join(wsDir, "AGENTS.md"), agentsContent, "utf-8");

      const bundle = await scanAndSanitizeImportSource({
        source: "standard-agents-md",
        sourceDir: wsDir,
        dryRun: true,
      });

      expect(bundle.identityMemories).toContain("AI Systems Engineer");
      expect(bundle.activeConstraints.some((c) => c.includes(REDACTED_SECRET_MARKER))).toBe(true);
      expect(bundle.activeConstraints.some((c) => c.includes("sk-ant-"))).toBe(false);
      expect(bundle.bashAllowlist).toContain("pnpm vitest");
      expect(bundle.redactedSecretsCount).toBe(1);
    });

    it("imports 'claude-code' layout (.claude/mcp.json & CLAUDE.md)", async () => {
      const wsDir = path.join(rootTmpDir, "claude-ws");
      const claudeDir = path.join(wsDir, ".claude");
      await fs.mkdir(claudeDir, { recursive: true });

      await fs.writeFile(
        path.join(wsDir, "CLAUDE.md"),
        `
# Claude Code Project Guidelines
## Guidelines
- ESM modules with TypeScript
## Constraints
- Do not add ts-nocheck
## Allowed Commands
- \`pnpm check\`
`,
        "utf-8",
      );

      await fs.writeFile(
        path.join(claudeDir, "mcp.json"),
        JSON.stringify({
          mcpServers: {
            memory: {
              command: "node",
              args: ["mcp-server-memory.js"],
            },
          },
        }),
        "utf-8",
      );

      const bundle = await scanAndSanitizeImportSource({
        source: "claude-code",
        sourceDir: wsDir,
        dryRun: true,
      });

      expect(bundle.source).toBe("claude-code");
      expect(bundle.durableMemories).toContain("ESM modules with TypeScript");
      expect(bundle.activeConstraints).toContain("Do not add ts-nocheck");
      expect(bundle.bashAllowlist).toContain("pnpm check");
      expect(bundle.mcpServers.memory).toBeDefined();
      expect(bundle.mcpServers.memory.command).toBe("node");
    });

    it("imports 'cursor' layout (.cursorrules & .cursor/rules/*.mdc)", async () => {
      const wsDir = path.join(rootTmpDir, "cursor-ws");
      const rulesDir = path.join(wsDir, ".cursor", "rules");
      await fs.mkdir(rulesDir, { recursive: true });

      await fs.writeFile(
        path.join(wsDir, ".cursorrules"),
        `You are a Senior Systems Architect.\nNever use any.\nAlways prefer functional purity.`,
        "utf-8",
      );

      await fs.writeFile(
        path.join(rulesDir, "backend.mdc"),
        `# Backend Architecture\n- Use SQLite WAL mode\n- Never block event loop`,
        "utf-8",
      );

      const bundle = await scanAndSanitizeImportSource({
        source: "cursor",
        sourceDir: wsDir,
        dryRun: true,
      });

      expect(bundle.source).toBe("cursor");
      expect(bundle.identityMemories).toContain("You are a Senior Systems Architect.");
      expect(bundle.activeConstraints).toContain("Never use any.");
      expect(bundle.activeConstraints).toContain("Never block event loop");
      expect(bundle.durableMemories).toContain("Use SQLite WAL mode");
    });

    it("handles missing sourceDir gracefully without crashing", async () => {
      const nonExistentDir = path.join(rootTmpDir, "does-not-exist");

      const bundle = await scanAndSanitizeImportSource({
        source: "windsurf",
        sourceDir: nonExistentDir,
        dryRun: true,
      });

      expect(bundle.warnings.length).toBeGreaterThan(0);
      expect(bundle.warnings[0]).toContain("Source directory does not exist");
      expect(bundle.identityMemories).toHaveLength(0);
      expect(bundle.durableMemories).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // 6. OOP UniversalAgentImporterService & Genuine Ingestion
  // -------------------------------------------------------------------------

  describe("UniversalAgentImporterService", () => {
    let cory: CoryBootstrapService;
    let synthesizer: CorySkillSynthesizerService;
    let importer: UniversalAgentImporterService;
    let coryDir: string;
    let skillsDir: string;

    beforeEach(async () => {
      coryDir = path.join(rootTmpDir, "cory-state");
      skillsDir = path.join(rootTmpDir, "skills-state");
      await fs.mkdir(coryDir, { recursive: true });
      await fs.mkdir(skillsDir, { recursive: true });

      cory = new CoryBootstrapService({ stateDir: coryDir });
      await cory.start();

      synthesizer = new CorySkillSynthesizerService({
        stateDir: skillsDir,
        coryService: cory,
      });
      await synthesizer.start();

      importer = new UniversalAgentImporterService();
    });

    afterEach(async () => {
      await cory.stop();
      await synthesizer.stop();
    });

    it("previewImport runs dry-run without writing to Cory memory or disk", async () => {
      const wsDir = path.join(rootTmpDir, "preview-ws");
      await fs.mkdir(wsDir, { recursive: true });

      await fs.writeFile(path.join(wsDir, "USER.md"), "- Preview User\n- Dry Run Persona", "utf-8");
      await fs.writeFile(path.join(wsDir, "MEMORY.md"), "- Preview Memory Architecture", "utf-8");

      const previewBundle = await importer.previewImport({
        source: "coreblow-bundle",
        sourceDir: wsDir,
      });

      expect(previewBundle.dryRun).toBe(true);
      expect(previewBundle.identityMemories).toContain("Preview User");

      // Verify that Cory memory store was NOT mutated
      const coryIdentityItems = cory.memoryStore.listLayerItems("identity", {
        workspaceId: "default",
        userScope: "default",
      });
      expect(coryIdentityItems).toHaveLength(0);
    });

    it("applyImport commits sanitized memories to Cory memory layers and indexes them", async () => {
      const wsDir = path.join(rootTmpDir, "apply-ws");
      await fs.mkdir(wsDir, { recursive: true });

      await fs.writeFile(
        path.join(wsDir, "USER.md"),
        "- Production Engineer with secret ghp_123456789012345678901234567890",
        "utf-8",
      );
      await fs.writeFile(
        path.join(wsDir, "MEMORY.md"),
        "- Zero-latency local caching architecture",
        "utf-8",
      );
      await fs.writeFile(
        path.join(wsDir, "CONSTRAINTS.md"),
        "- Never expose internal gateway ports",
        "utf-8",
      );

      const bundle = await importer.applyImport({
        source: "coreblow-bundle",
        sourceDir: wsDir,
        workspaceId: "prod-ws",
        cory,
        skillSynthesizer: synthesizer,
      });

      expect(bundle.dryRun).toBe(false);
      expect(bundle.redactedSecretsCount).toBe(1);

      // Verify Cory memory store layer items
      const identityItems = cory.memoryStore.listLayerItems("identity", {
        workspaceId: "prod-ws",
        userScope: "default",
      });
      expect(identityItems.length).toBeGreaterThanOrEqual(1);
      expect(identityItems[0].content).toContain(REDACTED_SECRET_MARKER);
      expect(identityItems[0].content).not.toContain("ghp_");

      const durableItems = cory.memoryStore.listLayerItems("durable", {
        workspaceId: "prod-ws",
        userScope: "default",
      });
      expect(durableItems.some((d) => d.content.includes("Zero-latency local caching"))).toBe(true);

      const constraintItems = cory.memoryStore.listLayerItems("constraint", {
        workspaceId: "prod-ws",
        userScope: "default",
      });
      expect(constraintItems.some((c) => c.content.includes("Never expose internal gateway"))).toBe(
        true,
      );

      // Verify physical markdown files exist
      const userMdPath = path.join(coryDir, "users", "default", "USER.md");
      const memoryMdPath = path.join(coryDir, "workspaces", "prod-ws", "MEMORY.md");
      const constraintsMdPath = path.join(coryDir, "workspaces", "prod-ws", "CONSTRAINTS.md");

      expect(fsSync.existsSync(userMdPath)).toBe(true);
      expect(fsSync.existsSync(memoryMdPath)).toBe(true);
      expect(fsSync.existsSync(constraintsMdPath)).toBe(true);

      // Verify BM25 search index recall
      const searchResults = cory.searchIndex.searchLexical({
        query: "Zero-latency",
        userScope: "default",
        workspaceId: "prod-ws",
      });
      expect(searchResults.length).toBeGreaterThanOrEqual(1);
    });

    it("applyImport passes valid skills through synthesizer security check and indexes them", async () => {
      const wsDir = path.join(rootTmpDir, "skill-ws");
      const skillDir = path.join(wsDir, "skills", "build-verify");
      await fs.mkdir(skillDir, { recursive: true });

      await fs.writeFile(
        path.join(skillDir, "SKILL.md"),
        `---
name: build-verification-procedure
description: Runs strict type check and lint verification
version: 1.0.0
---

# Build Verification Procedure

## Verified Procedure
1. Run tsgo type-check
2. Run oxlint linter
3. Ensure 0 errors
`,
        "utf-8",
      );

      const bundle = await importer.applyImport({
        source: "coreblow-bundle",
        sourceDir: wsDir,
        workspaceId: "test-skills",
        cory,
        skillSynthesizer: synthesizer,
      });

      expect(bundle.importedSkillNames).toContain("build-verification-procedure");
      expect(bundle.importedSkills).toHaveLength(1);

      // Verify durable memory indexing of the skill
      const durableItems = cory.memoryStore.listLayerItems("durable", {
        workspaceId: "test-skills",
        userScope: "default",
      });
      const skillMem = durableItems.find((d) =>
        d.content.includes("[LEARNED_SKILL] build-verification-procedure"),
      );
      expect(skillMem).toBeDefined();
    });

    it("applyImport rejects skills with security violations (Gate 2)", async () => {
      const wsDir = path.join(rootTmpDir, "malicious-skill-ws");
      const skillDir = path.join(wsDir, "skills", "malicious-eval");
      await fs.mkdir(skillDir, { recursive: true });

      // Create skill with eval() which is a critical AST security violation
      await fs.writeFile(
        path.join(skillDir, "SKILL.md"),
        `---
name: dangerous-eval-runner
description: Executes arbitrary dynamic code
version: 1.0.0
---

# Dangerous Eval Runner

## Verified Procedure
1. Execute eval(untrustedInput)
2. Send results
`,
        "utf-8",
      );

      const bundle = await importer.applyImport({
        source: "coreblow-bundle",
        sourceDir: wsDir,
        workspaceId: "quarantine-ws",
        cory,
        skillSynthesizer: synthesizer,
      });

      // Skill should be rejected by Gate 2 and logged in warnings
      expect(bundle.warnings.some((w) => w.includes("failed security gate"))).toBe(true);
      expect(bundle.importedSkills).toHaveLength(0);
    });
  });
});
