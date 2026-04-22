import { describe, it, expect } from "vitest";
import { FIELD_LABELS } from "./schema.labels.js";

describe("schema.labels FIELD_LABELS", () => {
  it("is a non-empty record", () => {
    expect(Object.keys(FIELD_LABELS).length).toBeGreaterThan(100);
  });

  it("has human-readable labels for top-level sections", () => {
    expect(FIELD_LABELS.meta).toBe("Metadata");
    expect(FIELD_LABELS.env).toBe("Environment");
    expect(FIELD_LABELS.agents).toBe("Agents");
    expect(FIELD_LABELS.gateway).toBe("Gateway");
    expect(FIELD_LABELS.browser).toBe("Browser");
    expect(FIELD_LABELS.tools).toBe("Tools");
    expect(FIELD_LABELS.session).toBe("Session");
    expect(FIELD_LABELS.cron).toBe("Cron");
    expect(FIELD_LABELS.hooks).toBe("Hooks");
    expect(FIELD_LABELS.plugins).toBe("Plugins");
    expect(FIELD_LABELS.auth).toBe("Auth");
    expect(FIELD_LABELS.models).toBe("Models");
    expect(FIELD_LABELS.memory).toBe("Memory");
  });

  it("has labels for gateway fields", () => {
    expect(FIELD_LABELS["gateway.port"]).toBe("Gateway Port");
    expect(FIELD_LABELS["gateway.mode"]).toBe("Gateway Mode");
    expect(FIELD_LABELS["gateway.auth"]).toBe("Gateway Auth");
    expect(FIELD_LABELS["gateway.auth.mode"]).toBe("Gateway Auth Mode");
    expect(FIELD_LABELS["gateway.tls"]).toBe("Gateway TLS");
  });

  it("has labels for session fields", () => {
    expect(FIELD_LABELS["session.scope"]).toBe("Session Scope");
    expect(FIELD_LABELS["session.idleMinutes"]).toBe("Session Idle Minutes");
    expect(FIELD_LABELS["session.mainKey"]).toBe("Session Main Key");
  });

  it("has labels for agent-specific fields", () => {
    expect(FIELD_LABELS["agents.defaults"]).toBe("Agent Defaults");
    expect(FIELD_LABELS["agents.list"]).toBe("Agent List");
    expect(FIELD_LABELS["agents.defaults.compaction"]).toBe("Compaction");
    expect(FIELD_LABELS["agents.defaults.compaction.mode"]).toBe("Compaction Mode");
  });

  it("has labels for cron fields", () => {
    expect(FIELD_LABELS["cron.enabled"]).toBe("Cron Enabled");
    expect(FIELD_LABELS["cron.store"]).toBe("Cron Store Path");
    expect(FIELD_LABELS["cron.maxConcurrentRuns"]).toBe("Cron Max Concurrent Runs");
  });

  it("has labels for browser fields", () => {
    expect(FIELD_LABELS["browser.enabled"]).toBe("Browser Enabled");
    expect(FIELD_LABELS["browser.headless"]).toBe("Browser Headless Mode");
    expect(FIELD_LABELS["browser.cdpUrl"]).toBe("Browser CDP URL");
  });

  it("all labels are non-empty strings", () => {
    for (const [key, label] of Object.entries(FIELD_LABELS)) {
      expect(typeof label).toBe("string");
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });
});
