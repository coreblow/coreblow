import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  expandContextReferences,
  expandSingleContextToken,
  isSensitivePath,
  isBinaryBuffer,
} from "./context-expander.js";

describe("context-expander", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-context-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe("isSensitivePath", () => {
    it("blocks .env, .env.local, .pem, and .key files", () => {
      expect(isSensitivePath(".env")).toBe(true);
      expect(isSensitivePath(".env.local")).toBe(true);
      expect(isSensitivePath(".env.production")).toBe(true);
      expect(isSensitivePath("certs/server.pem")).toBe(true);
      expect(isSensitivePath("secrets/private.key")).toBe(true);
    });

    it("blocks ssh and aws secret paths", () => {
      const sshPath = path.join(os.homedir(), ".ssh", "id_rsa");
      expect(isSensitivePath(sshPath)).toBe(true);
      const awsPath = path.join(os.homedir(), ".aws", "credentials");
      expect(isSensitivePath(awsPath)).toBe(true);
    });

    it("allows non-sensitive application files", () => {
      expect(isSensitivePath("src/app.ts")).toBe(false);
      expect(isSensitivePath("package.json")).toBe(false);
      expect(isSensitivePath("README.md")).toBe(false);
    });
  });

  describe("isBinaryBuffer", () => {
    it("detects null bytes in binary buffer", () => {
      const buf = Buffer.from([0x68, 0x65, 0x6c, 0x00, 0x6f]);
      expect(isBinaryBuffer(buf)).toBe(true);
    });

    it("identifies plain text buffer as non-binary", () => {
      const buf = Buffer.from("hello world\nline 2");
      expect(isBinaryBuffer(buf)).toBe(false);
    });
  });

  describe("expandSingleContextToken", () => {
    it("reads file content for @file:<path>", () => {
      const filePath = path.join(tempDir, "sample.txt");
      fs.writeFileSync(filePath, "line 1\nline 2\nline 3\nline 4\nline 5\n");

      const res = expandSingleContextToken("@file:sample.txt", tempDir);
      expect(res.error).toBeUndefined();
      expect(res.content).toContain("line 1");
      expect(res.content).toContain("line 5");
    });

    it("reads partial line range for @file:<path>:<start>-<end>", () => {
      const filePath = path.join(tempDir, "sample.txt");
      fs.writeFileSync(filePath, "line 1\nline 2\nline 3\nline 4\nline 5\n");

      const res = expandSingleContextToken("@file:sample.txt:2-4", tempDir);
      expect(res.error).toBeUndefined();
      expect(res.content).not.toContain("line 1");
      expect(res.content).toContain("line 2");
      expect(res.content).toContain("line 4");
      expect(res.content).not.toContain("line 5");
    });

    it("blocks sensitive files like .env", () => {
      const res = expandSingleContextToken("@file:.env", tempDir);
      expect(res.error).toContain("Blocked sensitive context path");
    });

    it("skips binary files cleanly", () => {
      const binPath = path.join(tempDir, "image.png");
      fs.writeFileSync(binPath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0a]));

      const res = expandSingleContextToken("@file:image.png", tempDir);
      expect(res.content).toContain("[Binary file skipped: image.png]");
    });
  });

  describe("expandContextReferences", () => {
    it("expands multiple references in a single prompt", () => {
      const fileA = path.join(tempDir, "a.txt");
      fs.writeFileSync(fileA, "hello from a");

      const res = expandContextReferences("Check this: @file:a.txt and review.", tempDir);
      expect(res.refused).toBeUndefined();
      expect(res.expanded).toContain("hello from a");
      expect(res.expanded).toContain("and review.");
    });

    it("refuses context expansion when exceeding 50% of context window", () => {
      const bigFile = path.join(tempDir, "big.txt");
      fs.writeFileSync(bigFile, "x".repeat(300_000));

      const smallContextChars = 100_000;
      const res = expandContextReferences("@file:big.txt", tempDir, smallContextChars);
      expect(res.refused).toBeDefined();
      expect(res.refused).toContain("exceeds 50% of active context window limit");
    });

    it("warns when context expansion exceeds 25% of context window", () => {
      const medFile = path.join(tempDir, "med.txt");
      fs.writeFileSync(medFile, "x".repeat(30_000));

      const contextChars = 100_000;
      const res = expandContextReferences("@file:med.txt", tempDir, contextChars);
      expect(res.refused).toBeUndefined();
      expect(res.warnings.length).toBeGreaterThan(0);
      expect(res.warnings[0]).toContain(">25% of active context budget");
    });
  });
});
