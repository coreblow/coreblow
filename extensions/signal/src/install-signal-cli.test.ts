import { describe, expect, it } from "vitest";
import { looksLikeArchive, pickAsset } from "./install-signal-cli.js";

describe("Signal CLI installer asset selection", () => {
  const assets = [
    { name: "signal-cli-linux-native.tar.gz", browser_download_url: "https://example/linux" },
    { name: "signal-cli-macos.tar.gz", browser_download_url: "https://example/macos" },
    { name: "signal-cli.tar.gz.asc", browser_download_url: "https://example/signature" },
  ];

  it("selects native assets only for compatible architectures", () => {
    expect(pickAsset(assets, "linux", "x64")?.name).toContain("linux-native");
    expect(pickAsset(assets, "linux", "arm64")).toBeUndefined();
    expect(pickAsset(assets, "darwin", "arm64")?.name).toContain("macos");
    expect(looksLikeArchive("file.tar.gz.asc")).toBe(false);
  });
});
