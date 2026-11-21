import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  escapeShellArg,
  executeCommandOnBackend,
  formatBackendBadge,
  probeBackendAvailability,
  type ExecutionBackendConfig,
} from "./execution-backend.js";

describe("execution-backend", () => {
  describe("formatBackendBadge", () => {
    it("formats local and sandbox badges", () => {
      expect(formatBackendBadge("local")).toBe("Local");
      expect(formatBackendBadge("sandbox")).toBe("Sandbox");
    });

    it("formats docker badge with image", () => {
      expect(formatBackendBadge("docker", "alpine:latest")).toBe("Docker:alpine:latest");
      expect(formatBackendBadge("docker")).toBe("Docker:node:22-slim");
    });

    it("formats ssh, node, and cloud badges", () => {
      expect(formatBackendBadge("ssh", "user@prod-box")).toBe("SSH:user@prod-box");
      expect(formatBackendBadge("node", "gpu-01")).toBe("Node:gpu-01");
      expect(formatBackendBadge("cloud", "https://runner.test")).toBe("Cloud:https://runner.test");
    });
  });

  describe("escapeShellArg", () => {
    it("safely quotes strings with single quotes", () => {
      expect(escapeShellArg("echo hello")).toBe("'echo hello'");
      expect(escapeShellArg("echo 'hello'")).toBe("'echo '\\''hello'\\'''");
      expect(escapeShellArg("rm -rf /")).toBe("'rm -rf /'");
    });
  });

  describe("probeBackendAvailability", () => {
    it("probes local backend as always available", async () => {
      const res = await probeBackendAvailability("local");
      expect(res.type).toBe("local");
      expect(res.available).toBe(true);
      expect(res.status).toBe("available");
    });

    it("probes sandbox backend using os-sandbox checks", async () => {
      const res = await probeBackendAvailability("sandbox");
      expect(res.type).toBe("sandbox");
      expect(typeof res.available).toBe("boolean");
    });

    it("reports ssh as unconfigured when target host is missing", async () => {
      const res = await probeBackendAvailability("ssh", { type: "ssh" });
      expect(res.type).toBe("ssh");
      expect(res.status).toBe("unconfigured");
    });

    it("reports cloud as unconfigured when endpoint is missing", async () => {
      const orig = process.env.COREBLOW_CLOUD_SANDBOX_URL;
      delete process.env.COREBLOW_CLOUD_SANDBOX_URL;
      const res = await probeBackendAvailability("cloud", { type: "cloud" });
      expect(res.type).toBe("cloud");
      expect(res.status).toBe("unconfigured");
      if (orig) process.env.COREBLOW_CLOUD_SANDBOX_URL = orig;
    });

    it("reports cloud as available when endpoint is specified", async () => {
      const res = await probeBackendAvailability("cloud", {
        type: "cloud",
        cloudEndpoint: "https://cloud.test",
      });
      expect(res.type).toBe("cloud");
      expect(res.status).toBe("available");
      expect(res.available).toBe(true);
    });
  });

  describe("executeCommandOnBackend - Security & Execution", () => {
    it("blocks catastrophic shell commands before dispatching", async () => {
      await expect(
        executeCommandOnBackend("rm -rf /", { type: "local" }),
      ).rejects.toThrow("CoreBlow safety guard");

      await expect(
        executeCommandOnBackend("mkfs.ext4 /dev/sda1", { type: "docker" }),
      ).rejects.toThrow("CoreBlow safety guard");
    });

    it("executes safe commands locally", async () => {
      const res = await executeCommandOnBackend("echo 'coreblow execution'", {
        type: "local",
      });
      expect(res.exitCode).toBe(0);
      expect(res.stdout.trim()).toBe("coreblow execution");
      expect(res.backend).toBe("local");
    });

    it("simulates cloud execution over mock fetch", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ stdout: "cloud output", exitCode: 0 }),
      });

      const res = await executeCommandOnBackend(
        "ls -la",
        {
          type: "cloud",
          cloudEndpoint: "https://mock-cloud.internal",
          cloudToken: "token-123",
        },
        {
          fetchFn: mockFetch as unknown as typeof fetch,
        },
      );

      expect(res.backend).toBe("cloud");
      expect(res.exitCode).toBe(0);
      expect(res.stdout).toBe("cloud output");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://mock-cloud.internal/api/exec",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer token-123",
          }),
        }),
      );
    });

    it("fails with informative error when ssh target is omitted", async () => {
      await expect(
        executeCommandOnBackend("whoami", { type: "ssh" }),
      ).rejects.toThrow("SSH backend requires target host");
    });

    it("fails with informative error when cloud endpoint is omitted", async () => {
      const orig = process.env.COREBLOW_CLOUD_SANDBOX_URL;
      delete process.env.COREBLOW_CLOUD_SANDBOX_URL;
      await expect(
        executeCommandOnBackend("whoami", { type: "cloud" }),
      ).rejects.toThrow("Cloud execution backend unconfigured");
      if (orig) process.env.COREBLOW_CLOUD_SANDBOX_URL = orig;
    });
  });
});
