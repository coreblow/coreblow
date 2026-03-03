import { describe, it, expect } from "vitest";

import { scopedHeartbeatWakeOptions, normalizeMainKey, toAgentRequestSessionKey, toAgentStoreSessionKey, resolveAgentIdFromSessionKey, classifySessionKeyShape, normalizeAgentId, isValidAgentId, sanitizeAgentId, buildAgentMainSessionKey, buildAgentPeerSessionKey, buildGroupHistoryKey, resolveThreadSessionKeys, DEFAULT_AGENT_ID, DEFAULT_MAIN_KEY } from "./session-key.js";

describe("Discord Session Key Continuity", () => {
  it("resolves all imports without errors", () => {
    expect(scopedHeartbeatWakeOptions).toBeDefined();
    expect(normalizeMainKey).toBeDefined();
    expect(toAgentRequestSessionKey).toBeDefined();
    expect(toAgentStoreSessionKey).toBeDefined();
    expect(resolveAgentIdFromSessionKey).toBeDefined();
    expect(classifySessionKeyShape).toBeDefined();
    expect(normalizeAgentId).toBeDefined();
    expect(isValidAgentId).toBeDefined();
    expect(sanitizeAgentId).toBeDefined();
    expect(buildAgentMainSessionKey).toBeDefined();
    expect(buildAgentPeerSessionKey).toBeDefined();
    expect(buildGroupHistoryKey).toBeDefined();
    expect(resolveThreadSessionKeys).toBeDefined();
    expect(DEFAULT_AGENT_ID).toBeDefined();
    expect(DEFAULT_MAIN_KEY).toBeDefined();
  });
});
