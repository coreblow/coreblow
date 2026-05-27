import { describe, expect, it, vi } from "vitest";
import {
  fetchClawHubPackageArtifact,
  fetchClawHubPackageDetail,
  normalizeClawHubSha256Hex,
  normalizeClawHubSha256Integrity,
  parseClawHubPluginSpec,
  resolveClawHubBaseUrl,
  searchClawHubSkills,
} from "./clawhub.js";

describe("ClawHub infra compatibility facade", () => {
  it("parses legacy clawhub specs through the CoreHub parser", () => {
    expect(parseClawHubPluginSpec("clawhub:demo@1.2.3")).toEqual({
      name: "demo",
      version: "1.2.3",
    });
    expect(parseClawHubPluginSpec("corehub:demo")).toEqual({ name: "demo" });
    expect(parseClawHubPluginSpec("npm:demo")).toBeNull();
  });

  it("keeps the default base URL on CoreHub", () => {
    expect(resolveClawHubBaseUrl()).toBe("https://coreblow.com/corehub");
  });

  it("normalizes SHA-256 compatibility helpers", () => {
    const hex = "A".repeat(64);
    const expectedIntegrity = `sha256-${Buffer.from(hex, "hex").toString("base64")}`;
    expect(normalizeClawHubSha256Hex(hex)).toBe(hex.toLowerCase());
    expect(normalizeClawHubSha256Integrity(hex)).toBe(expectedIntegrity);
    expect(normalizeClawHubSha256Integrity(`sha256:${hex}`)).toBe(expectedIntegrity);
    expect(normalizeClawHubSha256Integrity(expectedIntegrity)).toBe(expectedIntegrity);
    expect(normalizeClawHubSha256Integrity("nope")).toBeNull();
  });

  it("delegates package detail calls to CoreHub endpoints", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      expect(String(input)).toBe("https://coreblow.com/corehub/api/v1/packages/demo");
      return new Response(
        JSON.stringify({
          package: {
            name: "demo",
            displayName: "Demo",
            family: "code-plugin",
            channel: "official",
            isOfficial: true,
            createdAt: 0,
            updatedAt: 0,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    await expect(fetchClawHubPackageDetail({ name: "demo", fetchImpl })).resolves.toMatchObject({
      package: {
        name: "demo",
        family: "code-plugin",
      },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("maps CoreHub version metadata into the legacy artifact resolver shape", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      expect(String(input)).toBe("https://coreblow.com/corehub/api/v1/packages/demo/versions");
      return new Response(
        JSON.stringify([
          {
            version: "1.2.3",
            artifact: {
              sha256: "demo-sha256",
            },
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    await expect(
      fetchClawHubPackageArtifact({ name: "demo", version: "1.2.3", fetchImpl }),
    ).resolves.toMatchObject({
      package: {
        name: "demo",
        family: "code-plugin",
      },
      version: {
        version: "1.2.3",
      },
      artifact: {
        source: "corehub",
        packageName: "demo",
        version: "1.2.3",
        artifactSha256: "demo-sha256",
      },
    });
  });

  it("delegates skill search to CoreHub search", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      expect(String(input)).toBe("https://coreblow.com/corehub/api/v1/search?q=calendar&limit=1");
      return new Response(
        JSON.stringify({
          results: [{ score: 1, slug: "calendar", displayName: "Calendar" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    await expect(searchClawHubSkills({ query: "calendar", limit: 1, fetchImpl })).resolves.toEqual([
      { score: 1, slug: "calendar", displayName: "Calendar" },
    ]);
  });
});
