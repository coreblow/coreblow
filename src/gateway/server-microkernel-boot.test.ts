import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getActiveMicrokernel } from "./microkernel-services.js";
import { startGatewayServer } from "./server.impl.js";
import { getFreePort, installGatewayTestHooks } from "./test-helpers.server.js";

installGatewayTestHooks({ scope: "test" });

const EXPECTED_SERVICES = [
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
] as const;

describe("server cognitive microkernel boot integration", () => {
  it("boots 12 microkernel services, exposes /api/corehub routes with auth, and drains on close", async () => {
    const testStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-microkernel-boot-"));
    const prevGatewayToken = process.env.COREBLOW_GATEWAY_TOKEN;
    const prevMinimal = process.env.COREBLOW_TEST_MINIMAL_GATEWAY;
    const prevPort = process.env.COREBLOW_GATEWAY_PORT;

    const testToken = "test-token-corehub-123";
    process.env.COREBLOW_GATEWAY_TOKEN = testToken;
    process.env.COREBLOW_STATE_DIR = testStateDir;
    // Explicitly delete COREBLOW_TEST_MINIMAL_GATEWAY to exercise real non-minimal boot path (TA.1)
    delete process.env.COREBLOW_TEST_MINIMAL_GATEWAY;

    const port = await getFreePort();
    let server: Awaited<ReturnType<typeof startGatewayServer>> | null = null;
    let microkernelBeforeClose: ReturnType<typeof getActiveMicrokernel> = null;

    try {
      server = await startGatewayServer(port);

      // 1. After boot, getActiveMicrokernel() is non-null
      const activeMk = getActiveMicrokernel();
      expect(activeMk).not.toBeNull();
      microkernelBeforeClose = activeMk;

      // 2. The active microkernel's registry reports all 12 services registered and running
      const listedServices = activeMk!.registry.list();
      const registeredNames = listedServices.map((s) => s.name).sort();
      expect(registeredNames).toEqual([...EXPECTED_SERVICES].sort());

      for (const serviceName of EXPECTED_SERVICES) {
        const svc = listedServices.find((s) => s.name === serviceName);
        expect(svc).toBeDefined();
        expect(svc?.status).toBe("started");
      }

      // 3. GET /api/corehub/skills/learned with valid gateway token returns 200
      const authedResponse = await fetch(
        `http://127.0.0.1:${port}/api/corehub/skills/learned`,
        {
          headers: {
            Authorization: `Bearer ${testToken}`,
          },
        },
      );
      expect(authedResponse.status).toBe(200);
      const authedJson = (await authedResponse.json()) as { ok: boolean; count: number; skills: unknown[] };
      expect(authedJson.ok).toBe(true);
      expect(typeof authedJson.count).toBe("number");
      expect(Array.isArray(authedJson.skills)).toBe(true);

      // 4. The same request without a token returns 401 (real auth branch, not bypassed)
      const unauthedResponse = await fetch(
        `http://127.0.0.1:${port}/api/corehub/skills/learned`,
      );
      expect(unauthedResponse.status).toBe(401);
    } finally {
      // 5. After close(), getActiveMicrokernel() is null
      if (server) {
        await server.close();
      }
      expect(getActiveMicrokernel()).toBeNull();

      // 6. After close(), every cognitive service reports a non-running status
      expect(microkernelBeforeClose).not.toBeNull();
      const stoppedServices = microkernelBeforeClose!.registry.list();
      expect(stoppedServices.length).toBe(EXPECTED_SERVICES.length);
      for (const serviceName of EXPECTED_SERVICES) {
        const svc = stoppedServices.find((s) => s.name === serviceName);
        expect(svc).toBeDefined();
        expect(svc?.status).toBe("stopped");
      }

      // Clean up temp environment and state directory
      if (prevGatewayToken === undefined) {
        delete process.env.COREBLOW_GATEWAY_TOKEN;
      } else {
        process.env.COREBLOW_GATEWAY_TOKEN = prevGatewayToken;
      }
      if (prevMinimal === undefined) {
        delete process.env.COREBLOW_TEST_MINIMAL_GATEWAY;
      } else {
        process.env.COREBLOW_TEST_MINIMAL_GATEWAY = prevMinimal;
      }
      if (prevPort === undefined) {
        delete process.env.COREBLOW_GATEWAY_PORT;
      } else {
        process.env.COREBLOW_GATEWAY_PORT = prevPort;
      }
      await fs.rm(testStateDir, { recursive: true, force: true });
    }
  });
});
