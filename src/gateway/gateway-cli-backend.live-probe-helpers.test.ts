import { describe, expect, it } from "vitest";
import { assertLoopbackObjectSchemasHaveProperties } from "./gateway-cli-backend.live-probe-helpers.js";

describe("gateway cli backend live probe helpers", () => {
  it("accepts loopback object schemas with normalized properties", () => {
    expect(
      assertLoopbackObjectSchemasHaveProperties({
        tools: [
          {
            name: "cron",
            inputSchema: { type: "object", properties: { action: { type: "string" } } },
          },
        ],
        expectedSchemaProbeToolName: "cron",
      }),
    ).toBeUndefined();
  });

  it("rejects loopback object schemas without properties", () => {
    expect(() =>
      assertLoopbackObjectSchemasHaveProperties({
        tools: [{ name: "cron", inputSchema: { type: "object" } }],
      }),
    ).toThrow("mcp loopback tools/list exposed object schemas without properties: cron");
  });

  it("rejects a missing expected schema probe tool", () => {
    expect(() =>
      assertLoopbackObjectSchemasHaveProperties({
        tools: [{ name: "cron", inputSchema: { type: "object", properties: {} } }],
        expectedSchemaProbeToolName: "schema_probe",
      }),
    ).toThrow("mcp loopback tools/list did not expose schema_probe");
  });
});
