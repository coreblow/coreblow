/**
 * src/config/channel-config.test.ts
 *
 * CoreBlow — Channel Config Registry Tests
 * Verifies registerChannelSchema/getChannelSchema/listChannelSchemas
 * registry lifecycle and getRegisteredChannelIds.
 */
import { describe, expect, it } from "vitest";
import {
  getChannelSchema,
  getRegisteredChannelIds,
  listChannelSchemas,
  registerChannelSchema,
} from "./channel-config.js";
import type { ChannelConfigSchema } from "./channel-config.js";

function makeSchema(channelId: string): ChannelConfigSchema {
  return {
    channelId,
    label: channelId,
    validate: () => ({ valid: true, errors: [] }),
  } as unknown as ChannelConfigSchema;
}

describe("registerChannelSchema / getChannelSchema", () => {
  it("getChannelSchema returns undefined for unregistered channelId", () => {
    const result = getChannelSchema("nonexistent-channel-xyz");
    expect(result).toBeUndefined();
  });

  it("registerChannelSchema then getChannelSchema returns schema", () => {
    const schema = makeSchema("test-channel-abc");
    registerChannelSchema(schema);
    const found = getChannelSchema("test-channel-abc");
    expect(found).toBeDefined();
  });
});

describe("listChannelSchemas", () => {
  it("returns an array", () => {
    const result = listChannelSchemas();
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns non-empty array if any channel is registered", () => {
    registerChannelSchema(makeSchema("probe-channel-list"));
    expect(listChannelSchemas().length).toBeGreaterThan(0);
  });
});

describe("getRegisteredChannelIds", () => {
  it("returns an array of strings", () => {
    const ids = getRegisteredChannelIds();
    expect(Array.isArray(ids)).toBe(true);
    for (const id of ids) {
      expect(typeof id).toBe("string");
    }
  });

  it("includes newly registered channel id", () => {
    registerChannelSchema(makeSchema("probe-channel-ids"));
    const ids = getRegisteredChannelIds();
    expect(ids).toContain("probe-channel-ids");
  });
});
