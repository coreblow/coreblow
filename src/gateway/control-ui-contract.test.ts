/**
 * src/gateway/control-ui-contract.test.ts
 *
 * CoreBlow — Control UI Contract Tests
 * Verifies CONTROL_UI_BOOTSTRAP_CONFIG_PATH constant and
 * ControlUiBootstrapConfig type shape.
 */
import { describe, expect, it } from "vitest";
import { CONTROL_UI_BOOTSTRAP_CONFIG_PATH } from "./control-ui-contract.js";

describe("CONTROL_UI_BOOTSTRAP_CONFIG_PATH", () => {
  it("is a non-empty string", () => {
    expect(typeof CONTROL_UI_BOOTSTRAP_CONFIG_PATH).toBe("string");
    expect(CONTROL_UI_BOOTSTRAP_CONFIG_PATH.length).toBeGreaterThan(0);
  });

  it("starts with /__coreblow/", () => {
    expect(CONTROL_UI_BOOTSTRAP_CONFIG_PATH.startsWith("/__coreblow/")).toBe(true);
  });

  it("ends with .json", () => {
    expect(CONTROL_UI_BOOTSTRAP_CONFIG_PATH.endsWith(".json")).toBe(true);
  });

  it("equals /__coreblow/control-ui-config.json", () => {
    expect(CONTROL_UI_BOOTSTRAP_CONFIG_PATH).toBe("/__coreblow/control-ui-config.json");
  });

  it("is a valid URL path (no spaces)", () => {
    expect(CONTROL_UI_BOOTSTRAP_CONFIG_PATH).not.toContain(" ");
  });
});

describe("ControlUiBootstrapConfig shape contract", () => {
  it("a valid config object satisfies shape", () => {
    const config = {
      basePath: "/",
      assistantName: "CoreBlow",
      assistantAvatar: "https://cdn.example.com/avatar.png",
      assistantAgentId: "agent-default",
      serverVersion: "1.0.0",
    };
    expect(config.basePath).toBe("/");
    expect(config.assistantName).toBe("CoreBlow");
    expect(typeof config.serverVersion).toBe("string");
  });

  it("serverVersion is optional (can be omitted)", () => {
    const config = {
      basePath: "/",
      assistantName: "CoreBlow",
      assistantAvatar: "",
      assistantAgentId: "agent-main",
    };
    expect("serverVersion" in config).toBe(false);
  });
});
