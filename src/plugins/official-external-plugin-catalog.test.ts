import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  type OfficialExternalPluginCatalogEntry,
  getOfficialExternalPluginCatalogEntry,
  listOfficialExternalPluginCatalogEntries,
  resolveOfficialExternalPluginId,
  resolveOfficialExternalPluginInstall,
  verifyOfficialChannelArtifacts,
} from "./official-external-plugin-catalog.js";

function expectCatalogEntry(id: string): OfficialExternalPluginCatalogEntry {
  const entry = getOfficialExternalPluginCatalogEntry(id);
  if (entry === undefined) {
    throw new Error(`Expected external plugin catalog entry for ${id}`);
  }
  return entry;
}

describe("official external plugin catalog", () => {
  it("resolves channel lookup aliases to published plugin ids", () => {
    const discordByChannel = expectCatalogEntry("discord");
    const feishuByChannel = expectCatalogEntry("feishu");

    expect(resolveOfficialExternalPluginId(discordByChannel)).toBe("discord");
    expect(resolveOfficialExternalPluginInstall(discordByChannel)?.npmSpec).toBe(
      "@coreblow/discord",
    );
    expect(resolveOfficialExternalPluginId(feishuByChannel)).toBe("feishu");
  });

  it("keeps official launch package specs on the production package names", () => {
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("acpx"))?.npmSpec).toBe(
      "@openclaw/acpx",
    );
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("googlechat"))?.npmSpec).toBe(
      "@coreblow/googlechat",
    );
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("line"))?.npmSpec).toBe(
      "@coreblow/line",
    );
  });

  it("allows invalid-config recovery for externalized stock plugins", () => {
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("brave"))).toMatchObject({
      npmSpec: "@openclaw/brave-plugin",
      allowInvalidConfigRecovery: true,
    });
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("slack"))).toMatchObject({
      npmSpec: "@coreblow/slack",
      allowInvalidConfigRecovery: true,
    });
    expect(resolveOfficialExternalPluginInstall(expectCatalogEntry("discord"))).toMatchObject({
      npmSpec: "@coreblow/discord",
      allowInvalidConfigRecovery: true,
    });
  });

  it("resolves all 15 externalized community channels to canonical CoreHub specifiers", () => {
    const communityChannels = [
      "discord",
      "matrix",
      "twitch",
      "feishu",
      "line",
      "zalo",
      "zalouser",
      "qqbot",
      "mattermost",
      "nextcloud-talk",
      "synology-chat",
      "tlon",
      "nostr",
      "irc",
      "msteams",
    ];

    for (const channelId of communityChannels) {
      const entry = expectCatalogEntry(channelId);
      const install = resolveOfficialExternalPluginInstall(entry);
      expect(install).toBeDefined();
      expect(install?.corehubSpec).toBe(`corehub:@coreblow/${channelId}`);
      expect(install?.npmSpec).toBe(`@coreblow/${channelId}`);
      expect(install?.defaultChoice).toBe("corehub");
      expect(install?.minHostVersion).toBe(">=1.0.0");
    }
  });

  describe("verifyOfficialChannelArtifacts", () => {
    it("truthfully returns pending_external_artifact when artifact directory is absent on disk", () => {
      const result = verifyOfficialChannelArtifacts({
        artifactsDir: "/path/to/nonexistent/artifacts/dir/that/does/not/exist",
      });

      expect(result.status).toBe("pending_external_artifact");
      expect(result.totalChannels).toBeGreaterThanOrEqual(15);
      expect(result.verifiedCount).toBe(0);
      expect(result.missingCount).toBe(result.totalChannels);
      expect(result.missingArtifacts.length).toBe(result.totalChannels);
      expect(result.reason).toContain("Release archive directory");
    });

    it("cryptographically certifies artifacts when actual SHA-256 matches catalog expected checksum", () => {
      const tempDir = path.join(os.tmpdir(), `coreblow-verify-valid-${Date.now()}`);
      fs.mkdirSync(tempDir, { recursive: true });

      try {
        const fileContent = Buffer.from("valid-tarball-archive-payload-12345");
        const realSha256 = crypto.createHash("sha256").update(fileContent).digest("hex");

        const catalogPath = path.join(tempDir, "catalog.json");
        const artifactsDir = path.join(tempDir, "artifacts");
        fs.mkdirSync(artifactsDir, { recursive: true });

        fs.writeFileSync(path.join(artifactsDir, "discord-1.0.0.coreblow-plugin.tgz"), fileContent);
        fs.writeFileSync(
          catalogPath,
          JSON.stringify([
            {
              id: "@coreblow/discord",
              versions: [
                {
                  version: "1.0.0",
                  tag: "latest",
                  artifact: {
                    name: "discord-1.0.0.coreblow-plugin.tgz",
                    sha256: realSha256,
                  },
                },
              ],
            },
          ]),
        );

        const result = verifyOfficialChannelArtifacts({
          catalogPath,
          artifactsDir,
          channelIds: ["discord"],
        });

        expect(result.status).toBe("certified");
        expect(result.totalChannels).toBe(1);
        expect(result.verifiedCount).toBe(1);
        expect(result.missingCount).toBe(0);
        expect(result.checksumMismatches).toHaveLength(0);
        expect(result.malformedCatalogChecksums).toHaveLength(0);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("detects and flags invalid checksum with status 'failed' and records exact digests", () => {
      const tempDir = path.join(os.tmpdir(), `coreblow-verify-invalid-${Date.now()}`);
      fs.mkdirSync(tempDir, { recursive: true });

      try {
        const fileContent = Buffer.from("tampered-or-corrupted-artifact-data");
        const actualSha256 = crypto.createHash("sha256").update(fileContent).digest("hex");
        const expectedBogusSha = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

        const catalogPath = path.join(tempDir, "catalog.json");
        const artifactsDir = path.join(tempDir, "artifacts");
        fs.mkdirSync(artifactsDir, { recursive: true });

        fs.writeFileSync(path.join(artifactsDir, "matrix-1.0.0.coreblow-plugin.tgz"), fileContent);
        fs.writeFileSync(
          catalogPath,
          JSON.stringify([
            {
              id: "@coreblow/matrix",
              versions: [
                {
                  version: "1.0.0",
                  tag: "latest",
                  artifact: {
                    name: "matrix-1.0.0.coreblow-plugin.tgz",
                    sha256: expectedBogusSha,
                  },
                },
              ],
            },
          ]),
        );

        const result = verifyOfficialChannelArtifacts({
          catalogPath,
          artifactsDir,
          channelIds: ["matrix"],
        });

        expect(result.status).toBe("failed");
        expect(result.totalChannels).toBe(1);
        expect(result.verifiedCount).toBe(0);
        expect(result.checksumMismatches).toHaveLength(1);
        expect(result.checksumMismatches[0]).toEqual({
          channelId: "matrix",
          file: "matrix-1.0.0.coreblow-plugin.tgz",
          expectedSha256: expectedBogusSha,
          actualSha256,
        });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("reports missing artifacts truthfully when listed in catalog but absent from disk", () => {
      const tempDir = path.join(os.tmpdir(), `coreblow-verify-missing-${Date.now()}`);
      fs.mkdirSync(tempDir, { recursive: true });

      try {
        const catalogPath = path.join(tempDir, "catalog.json");
        const artifactsDir = path.join(tempDir, "artifacts");
        fs.mkdirSync(artifactsDir, { recursive: true });

        // Catalog lists twitch, but file is NOT in artifactsDir
        fs.writeFileSync(
          catalogPath,
          JSON.stringify([
            {
              id: "@coreblow/twitch",
              versions: [
                {
                  version: "1.0.0",
                  tag: "latest",
                  artifact: {
                    name: "twitch-1.0.0.coreblow-plugin.tgz",
                    sha256: "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899",
                  },
                },
              ],
            },
          ]),
        );

        const result = verifyOfficialChannelArtifacts({
          catalogPath,
          artifactsDir,
          channelIds: ["twitch"],
        });

        expect(result.status).toBe("pending_external_artifact");
        expect(result.totalChannels).toBe(1);
        expect(result.verifiedCount).toBe(0);
        expect(result.missingCount).toBe(1);
        expect(result.missingArtifacts).toContain("twitch");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("rejects malformed or missing catalog checksums and records diagnostics", () => {
      const tempDir = path.join(os.tmpdir(), `coreblow-verify-malformed-${Date.now()}`);
      fs.mkdirSync(tempDir, { recursive: true });

      try {
        const catalogPath = path.join(tempDir, "catalog.json");
        const artifactsDir = path.join(tempDir, "artifacts");
        fs.mkdirSync(artifactsDir, { recursive: true });

        fs.writeFileSync(path.join(artifactsDir, "feishu-1.0.0.coreblow-plugin.tgz"), "dummy");
        // Catalog lists feishu but sha256 is missing / malformed string
        fs.writeFileSync(
          catalogPath,
          JSON.stringify([
            {
              id: "@coreblow/feishu",
              versions: [
                {
                  version: "1.0.0",
                  tag: "latest",
                  artifact: {
                    name: "feishu-1.0.0.coreblow-plugin.tgz",
                    sha256: "not-a-valid-sha256",
                  },
                },
              ],
            },
          ]),
        );

        const result = verifyOfficialChannelArtifacts({
          catalogPath,
          artifactsDir,
          channelIds: ["feishu"],
        });

        expect(result.status).toBe("pending_external_artifact");
        expect(result.totalChannels).toBe(1);
        expect(result.verifiedCount).toBe(0);
        expect(result.malformedCatalogChecksums).toHaveLength(1);
        expect(result.malformedCatalogChecksums[0].channelId).toBe("feishu");
        expect(result.malformedCatalogChecksums[0].reason).toContain("Malformed checksum");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("cryptographically verifies all 15 satellite community channels when real corehub artifacts are present", () => {
      const satelliteCatalogPath = "/Users/febrinanda/coreblow-split/corehub/catalog.json";
      const satelliteArtifactsDir = "/Users/febrinanda/coreblow-split/corehub/artifacts";

      if (fs.existsSync(satelliteCatalogPath) && fs.existsSync(satelliteArtifactsDir)) {
        const result = verifyOfficialChannelArtifacts({
          catalogPath: satelliteCatalogPath,
          artifactsDir: satelliteArtifactsDir,
        });

        expect(result.status).toBe("certified");
        expect(result.totalChannels).toBe(15);
        expect(result.verifiedCount).toBe(15);
        expect(result.missingCount).toBe(0);
        expect(result.checksumMismatches).toHaveLength(0);
      }
    });
  });
});
