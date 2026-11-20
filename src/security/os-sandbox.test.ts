import { describe, expect, it } from "vitest";
import {
  buildSandboxedCommand,
  checkSandboxAvailability,
  generateSeatbeltProfile,
  isCommandExcludedFromSandbox,
} from "./os-sandbox.js";

describe("os-sandbox", () => {
  describe("generateSeatbeltProfile", () => {
    it("generates a valid profile allowing cwd and temp while denying write by default", () => {
      const profile = generateSeatbeltProfile({
        cwd: "/Users/test/project",
      });

      expect(profile).toContain("(version 1)");
      expect(profile).toContain("(deny file-write*)");
      expect(profile).toContain('(allow file-write* (subpath "/Users/test/project"))');
      expect(profile).toContain('.coreblow');
      expect(profile).toContain('.git/hooks');
    });

    it("denies credential reads when denyReadCredentials is true", () => {
      const profile = generateSeatbeltProfile({
        cwd: "/Users/test/project",
        denyReadCredentials: true,
      });

      expect(profile).toContain('(deny file-read* (subpath "');
      expect(profile).toContain('.ssh');
      expect(profile).toContain('.aws');
    });
  });

  describe("isCommandExcludedFromSandbox", () => {
    it("excludes docker and podman commands from sandboxing", () => {
      expect(isCommandExcludedFromSandbox("docker run -it alpine")).toBe(true);
      expect(isCommandExcludedFromSandbox("docker build .")).toBe(true);
      expect(isCommandExcludedFromSandbox("podman ps")).toBe(true);
    });

    it("does not exclude standard shell commands", () => {
      expect(isCommandExcludedFromSandbox("git status")).toBe(false);
      expect(isCommandExcludedFromSandbox("pnpm test")).toBe(false);
      expect(isCommandExcludedFromSandbox("cat package.json")).toBe(false);
    });
  });

  describe("checkSandboxAvailability", () => {
    it("reports availability gracefully without throwing", () => {
      const res = checkSandboxAvailability();
      expect(typeof res.available).toBe("boolean");
      expect(["seatbelt", "bwrap", "none"]).toContain(res.engine);
      expect(typeof res.details).toBe("string");
    });
  });

  describe("buildSandboxedCommand", () => {
    it("returns raw command when sandbox mode is off", () => {
      const res = buildSandboxedCommand("pnpm test", { mode: "off" });
      expect(res.sandboxed).toBe(false);
      expect(res.command).toBe("pnpm test");
      expect(res.engine).toBe("none");
    });

    it("returns raw command when command is in exclusion list", () => {
      const res = buildSandboxedCommand("docker run alpine", { mode: "regular" });
      expect(res.sandboxed).toBe(false);
      expect(res.command).toBe("docker run alpine");
      expect(res.reason).toContain("exclusion");
    });

    it("wraps command in sandbox-exec on macOS when available", () => {
      if (process.platform === "darwin") {
        const res = buildSandboxedCommand("echo safe", { mode: "regular" });
        if (res.sandboxed) {
          expect(res.engine).toBe("seatbelt");
          expect(res.command).toContain("sandbox-exec -p");
          expect(res.command).toContain("echo safe");
        }
      }
    });
  });
});
