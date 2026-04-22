import { describe, it, expect } from "vitest";
import {
  resolveNodeCommandAllowlist,
  isNodeCommandAllowed,
  DEFAULT_DANGEROUS_NODE_COMMANDS,
} from "./node-command-policy.js";

describe("resolveNodeCommandAllowlist", () => {
  it("returns platform-specific defaults for iOS", () => {
    const allowlist = resolveNodeCommandAllowlist({} as any, { platform: "iOS", deviceFamily: undefined });
    expect(allowlist.has("canvas.present")).toBe(true);
    expect(allowlist.has("camera.list")).toBe(true);
    expect(allowlist.has("location.get")).toBe(true);
    // iOS does NOT have system.run
    expect(allowlist.has("system.run")).toBe(false);
  });

  it("returns platform-specific defaults for android", () => {
    const allowlist = resolveNodeCommandAllowlist({} as any, { platform: "android", deviceFamily: undefined });
    expect(allowlist.has("canvas.present")).toBe(true);
    expect(allowlist.has("sms.search")).toBe(true);
    expect(allowlist.has("notifications.actions")).toBe(true);
  });

  it("returns system.run for macOS", () => {
    const allowlist = resolveNodeCommandAllowlist({} as any, { platform: "macOS", deviceFamily: undefined });
    expect(allowlist.has("system.run")).toBe(true);
    expect(allowlist.has("canvas.present")).toBe(true);
  });

  it("returns system.run for linux", () => {
    const allowlist = resolveNodeCommandAllowlist({} as any, { platform: "linux", deviceFamily: undefined });
    expect(allowlist.has("system.run")).toBe(true);
  });

  it("falls back to unknown platform defaults", () => {
    const allowlist = resolveNodeCommandAllowlist({} as any, { platform: "beos", deviceFamily: undefined });
    expect(allowlist.has("canvas.present")).toBe(true);
    expect(allowlist.has("system.run")).toBe(false);
  });

  it("merges gateway.nodes.allowCommands", () => {
    const cfg = { gateway: { nodes: { allowCommands: ["custom.cmd"] } } } as any;
    const allowlist = resolveNodeCommandAllowlist(cfg, { platform: "linux", deviceFamily: undefined });
    expect(allowlist.has("custom.cmd")).toBe(true);
    expect(allowlist.has("system.run")).toBe(true);
  });

  it("removes gateway.nodes.denyCommands", () => {
    const cfg = { gateway: { nodes: { denyCommands: ["system.run"] } } } as any;
    const allowlist = resolveNodeCommandAllowlist(cfg, { platform: "linux", deviceFamily: undefined });
    expect(allowlist.has("system.run")).toBe(false);
  });

  it("resolves platform from deviceFamily when platform is unknown", () => {
    const allowlist = resolveNodeCommandAllowlist({} as any, { platform: undefined, deviceFamily: "iPhone" });
    // deviceFamily "iPhone" should resolve to iOS
    expect(allowlist.has("camera.list")).toBe(true);
    expect(allowlist.has("location.get")).toBe(true);
  });
});

describe("isNodeCommandAllowed", () => {
  const allowlist = new Set(["system.run", "canvas.present", "camera.list"]);

  it("allows listed commands with declared commands", () => {
    const result = isNodeCommandAllowed({
      command: "system.run",
      declaredCommands: ["system.run", "canvas.present"],
      allowlist,
    });
    expect(result).toEqual({ ok: true });
  });

  it("rejects command not in allowlist", () => {
    const result = isNodeCommandAllowed({
      command: "rm.all",
      declaredCommands: ["rm.all"],
      allowlist,
    });
    expect(result).toEqual({ ok: false, reason: "command not allowlisted" });
  });

  it("rejects command not declared by node", () => {
    const result = isNodeCommandAllowed({
      command: "system.run",
      declaredCommands: ["canvas.present"],
      allowlist,
    });
    expect(result).toEqual({ ok: false, reason: "command not declared by node" });
  });

  it("rejects empty command", () => {
    const result = isNodeCommandAllowed({
      command: "  ",
      declaredCommands: ["system.run"],
      allowlist,
    });
    expect(result).toEqual({ ok: false, reason: "command required" });
  });

  it("rejects when node declares no commands", () => {
    const result = isNodeCommandAllowed({
      command: "system.run",
      declaredCommands: [],
      allowlist,
    });
    expect(result).toEqual({ ok: false, reason: "node did not declare commands" });
  });

  it("rejects when declaredCommands is undefined", () => {
    const result = isNodeCommandAllowed({
      command: "system.run",
      allowlist,
    });
    expect(result).toEqual({ ok: false, reason: "node did not declare commands" });
  });
});

describe("DEFAULT_DANGEROUS_NODE_COMMANDS", () => {
  it("includes high-risk commands", () => {
    expect(DEFAULT_DANGEROUS_NODE_COMMANDS).toContain("camera.snap");
    expect(DEFAULT_DANGEROUS_NODE_COMMANDS).toContain("sms.send");
    expect(DEFAULT_DANGEROUS_NODE_COMMANDS).toContain("contacts.add");
    expect(DEFAULT_DANGEROUS_NODE_COMMANDS).toContain("screen.record");
  });
});
