import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  registerProfile,
  getProfile,
  setDefaultProfile,
  getDefaultProfile,
  listProfiles,
  clearProfiles,
  resolveIdentity,
  parseAvatar,
  validateAvatar,
  createIdentity,
  isHttpUrl,
  isDataUri,
  isPathWithinRoot,
} from "./identity-avatar.js";

beforeEach(() => clearProfiles());
afterEach(() => clearProfiles());

describe("identity profile management", () => {
  it("registers and retrieves profiles", () => {
    registerProfile({
      id: "main",
      identity: { name: "CoreBlow" },
    });
    expect(getProfile("main")).toBeDefined();
    expect(getProfile("main")!.identity.name).toBe("CoreBlow");
  });

  it("sets and gets default profile", () => {
    registerProfile({ id: "custom", identity: { name: "Custom" } });
    setDefaultProfile("custom");
    expect(getDefaultProfile()!.identity.name).toBe("Custom");
  });

  it("lists all profiles", () => {
    registerProfile({ id: "a", identity: { name: "A" } });
    registerProfile({ id: "b", identity: { name: "B" } });
    expect(listProfiles()).toHaveLength(2);
  });

  it("clears all profiles", () => {
    registerProfile({ id: "x", identity: { name: "X" } });
    clearProfiles();
    expect(listProfiles()).toHaveLength(0);
  });
});

describe("resolveIdentity", () => {
  it("returns channel-specific identity when matched", () => {
    registerProfile({
      id: "discord-bot",
      identity: { name: "DiscordBot" },
      channels: ["discord"],
    });
    expect(resolveIdentity("discord").name).toBe("DiscordBot");
  });

  it("falls back to default profile identity", () => {
    registerProfile({
      id: "default",
      identity: { name: "MainBot" },
    });
    setDefaultProfile("default");
    expect(resolveIdentity("unknown-channel").name).toBe("MainBot");
  });

  it("returns CoreBlow fallback when no profiles exist", () => {
    const identity = resolveIdentity();
    expect(identity.name).toBe("CoreBlow");
    expect(identity.displayName).toBe("CoreBlow Assistant");
  });
});

describe("parseAvatar", () => {
  it("parses URL avatar", () => {
    const result = parseAvatar("https://example.com/avatar.png");
    expect(result.type).toBe("url");
    expect(result.value).toBe("https://example.com/avatar.png");
  });

  it("parses data URI avatar", () => {
    const result = parseAvatar("data:image/png;base64,iVBORw0KGgo=");
    expect(result.type).toBe("data-uri");
  });

  it("parses file path avatar", () => {
    const result = parseAvatar("./assets/avatar.png");
    expect(result.type).toBe("file");
  });

  it("returns none for undefined/empty", () => {
    expect(parseAvatar(undefined).type).toBe("none");
    expect(parseAvatar("").type).toBe("none");
  });
});

describe("validateAvatar", () => {
  it("validates valid URL", () => {
    const result = validateAvatar({ type: "url", value: "https://cdn.example.com/avatar.png" });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("warns on HTTP URL", () => {
    const result = validateAvatar({ type: "url", value: "http://cdn.example.com/avatar.png" });
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain("HTTP instead of HTTPS");
  });

  it("rejects invalid URL", () => {
    const result = validateAvatar({ type: "url", value: "not-a-url" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Invalid avatar URL");
  });

  it("validates valid data URI", () => {
    const result = validateAvatar({ type: "data-uri", value: "data:image/png;base64,abc=" });
    expect(result.valid).toBe(true);
  });

  it("warns on large data URI", () => {
    const bigValue = "data:image/png;base64," + "A".repeat(1_000_001);
    const result = validateAvatar({ type: "data-uri", value: bigValue });
    expect(result.warnings).toContain("Data URI >1MB");
  });

  it("warns on absolute file path", () => {
    const result = validateAvatar({ type: "file", value: "/absolute/path/avatar.png" });
    expect(result.warnings).toContain("Absolute path not portable");
  });

  it("rejects file path outside root", () => {
    const result = validateAvatar({ type: "file", value: "../../etc/passwd" }, "/home/user/project");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Path outside root");
  });
});

describe("createIdentity", () => {
  it("creates identity with defaults", () => {
    const identity = createIdentity({});
    expect(identity.name).toBe("CoreBlow");
    expect(identity.language).toBe("en");
  });

  it("creates identity with custom values", () => {
    const identity = createIdentity({ name: "MyBot", bio: "A helpful bot", language: "id" });
    expect(identity.name).toBe("MyBot");
    expect(identity.displayName).toBe("MyBot");
    expect(identity.bio).toBe("A helpful bot");
    expect(identity.language).toBe("id");
  });
});

describe("utility functions", () => {
  it("isHttpUrl detects HTTP(S) URLs", () => {
    expect(isHttpUrl("https://example.com")).toBe(true);
    expect(isHttpUrl("http://example.com")).toBe(true);
    expect(isHttpUrl("ftp://example.com")).toBe(false);
    expect(isHttpUrl("not-a-url")).toBe(false);
  });

  it("isDataUri detects data URIs", () => {
    expect(isDataUri("data:image/png;base64,abc")).toBe(true);
    expect(isDataUri("data:image/svg+xml;base64,abc")).toBe(true);
    expect(isDataUri("not-a-data-uri")).toBe(false);
  });

  it("isPathWithinRoot checks containment", () => {
    expect(isPathWithinRoot("assets/avatar.png", "/home/user/project")).toBe(true);
    expect(isPathWithinRoot("./avatar.png", "/home/user/project")).toBe(true);
  });
});
