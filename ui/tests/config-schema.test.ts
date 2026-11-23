import { describe, expect, it } from "vitest";
import {
  extractSchemaSections,
  countLeafFields,
  resolveNodeType,
  resolveEnumOptions,
  isSecretField,
  searchSchemaFields,
  getByPath,
  setByPath,
  OFFLINE_SCHEMA_CATALOG,
  type JsonSchemaNode,
} from "../src/ui/views/config-schema-renderer.ts";
import { ConfigView } from "../src/ui/views/config.ts";
import type { CoreBlowApp } from "../src/ui/app.ts";

function createMockApp(connected = false): CoreBlowApp {
  return {
    connected,
    settings: {
      gatewayUrl: "ws://127.0.0.1:18789",
      token: "mock-token-abc",
      theme: "obsidian",
      themeMode: "dark",
      locale: "en",
    },
    gateway: {
      getClient: () => null,
      reconnect: () => {},
    },
    saveSettings: () => {},
    applySettings: () => {},
    requestUpdate: () => {},
  } as unknown as CoreBlowApp;
}

describe("Config Schema Parser & Renderer Engine", () => {
  it("extracts top-level sections from Draft-07 schema with accurate leaf counts", () => {
    const testSchema: JsonSchemaNode = {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        logging: {
          type: "object",
          description: "Logging configuration",
          properties: {
            level: {
              anyOf: [
                { const: "info" },
                { const: "warn" },
                { const: "error" },
                { const: "debug" },
              ],
            },
            consoleStyle: {
              type: "string",
              enum: ["pretty", "compact", "json"],
            },
            redactSensitive: {
              type: "boolean",
            },
          },
        },
        agents: {
          type: "object",
          properties: {
            defaults: {
              type: "object",
              properties: {
                model: { type: "string" },
                contextTokens: { type: "integer", minimum: 1000 },
                thinkingDefault: {
                  anyOf: [{ const: "auto" }, { const: "low" }, { const: "high" }],
                },
              },
            },
          },
        },
      },
    };

    const sections = extractSchemaSections(testSchema);
    expect(sections.length).toBe(2);

    const loggingSec = sections.find((s) => s.id === "logging");
    expect(loggingSec).toBeDefined();
    expect(loggingSec?.label).toBe("Logging");
    expect(loggingSec?.icon).toBe("scrollText");
    expect(loggingSec?.fieldCount).toBe(3);

    const agentsSec = sections.find((s) => s.id === "agents");
    expect(agentsSec).toBeDefined();
    expect(agentsSec?.label).toBe("Agents");
    expect(agentsSec?.icon).toBe("bot");
    expect(agentsSec?.fieldCount).toBe(3);
  });

  it("resolves node types, const-union enums, numbers, and booleans correctly", () => {
    const booleanNode: JsonSchemaNode = { type: "boolean" };
    expect(resolveNodeType(booleanNode)).toBe("boolean");

    const numberNode: JsonSchemaNode = { type: "integer", minimum: 1 };
    expect(resolveNodeType(numberNode)).toBe("number");

    const enumNode: JsonSchemaNode = {
      anyOf: [
        { type: "string", const: "silent" },
        { type: "string", const: "info" },
        { type: "string", const: "debug" },
      ],
    };
    expect(resolveNodeType(enumNode)).toBe("enum");
    expect(resolveEnumOptions(enumNode)).toEqual(["silent", "info", "debug"]);

    const arrayNode: JsonSchemaNode = {
      type: "array",
      items: { type: "string" },
    };
    expect(resolveNodeType(arrayNode)).toBe("array");
  });

  it("detects secret fields and prevents false positives", () => {
    expect(isSecretField("token", "gateway.auth.token")).toBe(true);
    expect(isSecretField("apiKey", "models.providers.openai.apiKey")).toBe(true);
    expect(isSecretField("botToken", "channels.telegram.botToken")).toBe(true);
    expect(isSecretField("password", "database.password")).toBe(true);
    expect(isSecretField("client_secret", "oauth.client_secret")).toBe(true);

    // Non-secrets (must not falsely mask)
    expect(isSecretField("keyboard", "ui.keyboard")).toBe(false);
    expect(isSecretField("keybinding", "ui.keybinding")).toBe(false);
    expect(isSecretField("model", "agents.defaults.model")).toBe(false);
    expect(isSecretField("port", "gateway.port")).toBe(false);
  });

  it("walks and filters fields across all schema sections via search", () => {
    const matches = searchSchemaFields(OFFLINE_SCHEMA_CATALOG, "model");
    expect(matches.length).toBeGreaterThan(0);
    const hasAgentModel = matches.some((m) => m.path.includes("model"));
    expect(hasAgentModel).toBe(true);

    const portMatches = searchSchemaFields(OFFLINE_SCHEMA_CATALOG, "port");
    expect(portMatches.length).toBeGreaterThan(0);
    expect(portMatches.some((m) => m.path === "gateway.port")).toBe(true);

    const emptyMatches = searchSchemaFields(OFFLINE_SCHEMA_CATALOG, "nonexistentxyz123");
    expect(emptyMatches.length).toBe(0);
  });

  it("handles deep get and set by dot-path", () => {
    const config = {
      logging: { level: "info" },
      agents: { defaults: { model: "gemini-2.5-pro" } },
    };

    expect(getByPath(config, "logging.level")).toBe("info");
    expect(getByPath(config, "agents.defaults.model")).toBe("gemini-2.5-pro");
    expect(getByPath(config, "unknown.path")).toBeUndefined();

    const updated = setByPath(config, "agents.defaults.thinkingDefault", "high");
    expect(getByPath(updated, "agents.defaults.thinkingDefault")).toBe("high");
    expect(getByPath(updated, "agents.defaults.model")).toBe("gemini-2.5-pro");
  });

  it("renders offline fallback catalog without blank screen when gateway is disconnected", () => {
    const view = new ConfigView();
    view.app = createMockApp(false);
    view.connectedCallback();

    expect(view.sections.length).toBeGreaterThanOrEqual(18);
    expect(view.activeSectionId).toBe("gateway");
    expect(view.editGatewayUrl).toBe("ws://127.0.0.1:18789");

    const template = view.render();
    expect(template).toBeDefined();

    // Verify sections include core CoreBlow sections
    const sectionIds = view.sections.map((s) => s.id);
    expect(sectionIds).toContain("gateway");
    expect(sectionIds).toContain("agents");
    expect(sectionIds).toContain("models");
    expect(sectionIds).toContain("tools");
    expect(sectionIds).toContain("channels");
    expect(sectionIds).toContain("logging");
    expect(sectionIds).toContain("browser");
    expect(sectionIds).toContain("secrets");
    expect(sectionIds).toContain("ui");
  });
});
