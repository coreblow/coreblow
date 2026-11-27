import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseSyncArgs, syncFleet } from "../../scripts/fleet/fleet-engine.mjs";

const VALID_HEX = "500367ebc292097867bcba794edc6f6e8d3fa2b0605103c9476f76f0b7a78017";
const VALID_SRI = "sha256-UANn68KSCXhnvLp5Ttxvbo0/orBgUQPJR2928LengBc=";

function createSatelliteFixtures(rootDir: string) {
  const comDir = path.join(rootDir, "coreblow.com");
  const brewDir = path.join(rootDir, "homebrew-tap");
  const nixDir = path.join(rootDir, "nix-coreblow");

  fs.mkdirSync(path.join(comDir, "public"), { recursive: true });
  fs.mkdirSync(path.join(comDir, "src"), { recursive: true });
  fs.mkdirSync(path.join(brewDir, "Formula"), { recursive: true });
  fs.mkdirSync(nixDir, { recursive: true });

  const installBanner =
    '#!/usr/bin/env sh\n   Sovereign Autonomous Agent-OS · v2.3.0 GA\nCOREBLOW_VERSION="${COREBLOW_VERSION:-2.3.0}"\n';
  fs.writeFileSync(path.join(comDir, "public/install.sh"), installBanner, "utf8");
  fs.writeFileSync(path.join(comDir, "public/install-cli.sh"), installBanner, "utf8");
  fs.writeFileSync(
    path.join(comDir, "public/install.ps1"),
    '$CoreBlowVersion = if ($env:COREBLOW_VERSION) { $env:COREBLOW_VERSION } else { "2.3.0" }\n   Sovereign Autonomous Agent-OS · v2.3.0 GA\n',
    "utf8",
  );
  fs.writeFileSync(
    path.join(comDir, "src/index.js"),
    'const HTML = "<meta content=\\"CoreBlow v2.3.0 Sovereign\\" /><span>v2.3.0 GA</span>";\nconst SH = "CoreBlow v2.3.0 requires Node >= 22.12.0";\n',
    "utf8",
  );
  fs.writeFileSync(
    path.join(brewDir, "Formula/coreblow.rb"),
    'class Coreblow < Formula\n  url "https://registry.npmjs.org/coreblow/-/coreblow-2.3.0.tgz"\n  sha256 "0000000000000000000000000000000000000000000000000000000000000000"\nend\n',
    "utf8",
  );
  fs.writeFileSync(
    path.join(nixDir, "flake.nix"),
    'coreblow = {\n  version = "2.3.0";\n  sha256 = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";\n};\ncoreblow-studio = {\n  version = "2.3.0";\n};\n',
    "utf8",
  );

  return { comDir, brewDir, nixDir };
}

describe("fleet sync subcommand", () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const dir of tempRoots.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects invalid version, sha256, and sri inputs cleanly", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-fleet-sync-"));
    tempRoots.push(tmp);
    createSatelliteFixtures(tmp);

    expect(() =>
      syncFleet({ version: "v2.3.1", sha256: VALID_HEX, sri: VALID_SRI, splitRoot: tmp }),
    ).toThrow(/Invalid --version/);
    expect(() =>
      syncFleet({ version: "2.3.1", sha256: "deadbeef", sri: VALID_SRI, splitRoot: tmp }),
    ).toThrow(/Invalid --sha256/);
    expect(() =>
      syncFleet({ version: "2.3.1", sha256: VALID_HEX, sri: "md5-abc", splitRoot: tmp }),
    ).toThrow(/Invalid --sri/);
  });

  it("fails cleanly if an expected satellite pattern is missing without partial writes", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-fleet-sync-"));
    tempRoots.push(tmp);
    const { comDir, nixDir } = createSatelliteFixtures(tmp);
    fs.writeFileSync(
      path.join(nixDir, "flake.nix"),
      'coreblow = { version = "2.3.0"; };\n',
      "utf8",
    );

    expect(() =>
      syncFleet({ version: "2.3.1", sha256: VALID_HEX, sri: VALID_SRI, splitRoot: tmp }),
    ).toThrow(/Pattern mismatch in nix-coreblow\/flake\.nix/);
    expect(fs.readFileSync(path.join(comDir, "public/install.sh"), "utf8")).toContain("2.3.0");
  });

  it("performs zero filesystem writes during --dry-run and reports planned updates", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-fleet-sync-"));
    tempRoots.push(tmp);
    const { comDir, brewDir, nixDir } = createSatelliteFixtures(tmp);

    const planned = syncFleet({
      version: "2.3.1",
      sha256: VALID_HEX,
      sri: VALID_SRI,
      dryRun: true,
      splitRoot: tmp,
    });

    expect(planned).toHaveLength(6);
    expect(planned.every((entry) => entry.changed)).toBe(true);
    expect(fs.readFileSync(path.join(comDir, "public/install.sh"), "utf8")).toContain("2.3.0");
    expect(fs.readFileSync(path.join(comDir, "public/install.ps1"), "utf8")).toContain("2.3.0");
    expect(fs.readFileSync(path.join(brewDir, "Formula/coreblow.rb"), "utf8")).toContain("2.3.0");
    expect(fs.readFileSync(path.join(nixDir, "flake.nix"), "utf8")).toContain('version = "2.3.0"');
  });

  it("updates all 6 distribution targets accurately and idempotently on /tmp fixtures", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-fleet-sync-"));
    tempRoots.push(tmp);
    const { comDir, brewDir, nixDir } = createSatelliteFixtures(tmp);

    const first = syncFleet({
      version: "2.3.1",
      sha256: VALID_HEX,
      sri: VALID_SRI,
      dryRun: false,
      splitRoot: tmp,
    });
    expect(first).toHaveLength(6);
    expect(first.every((entry) => entry.changed)).toBe(true);

    const installSh = fs.readFileSync(path.join(comDir, "public/install.sh"), "utf8");
    const installCliSh = fs.readFileSync(path.join(comDir, "public/install-cli.sh"), "utf8");
    const installPs1 = fs.readFileSync(path.join(comDir, "public/install.ps1"), "utf8");
    const indexJs = fs.readFileSync(path.join(comDir, "src/index.js"), "utf8");
    const rb = fs.readFileSync(path.join(brewDir, "Formula/coreblow.rb"), "utf8");
    const flake = fs.readFileSync(path.join(nixDir, "flake.nix"), "utf8");

    expect(installSh).toContain("Sovereign Autonomous Agent-OS · v2.3.1 GA");
    expect(installSh).toContain('COREBLOW_VERSION="${COREBLOW_VERSION:-2.3.1}"');
    expect(installCliSh).toContain("Sovereign Autonomous Agent-OS · v2.3.1 GA");
    expect(installCliSh).toContain('COREBLOW_VERSION="${COREBLOW_VERSION:-2.3.1}"');
    expect(installPs1).toContain("Sovereign Autonomous Agent-OS · v2.3.1 GA");
    expect(installPs1).toContain('else { "2.3.1" }');
    expect(indexJs).toContain("CoreBlow v2.3.1 Sovereign");
    expect(indexJs).toContain("v2.3.1 GA");
    expect(indexJs).toContain("CoreBlow v2.3.1 requires");
    expect(rb).toContain("https://registry.npmjs.org/coreblow/-/coreblow-2.3.1.tgz");
    expect(rb).toContain(`sha256 "${VALID_HEX}"`);
    expect(flake.match(/version = "2\.3\.1";/g)).toHaveLength(2);
    expect(flake).toContain(`sha256 = "${VALID_SRI}";`);

    const second = syncFleet({
      version: "2.3.1",
      sha256: VALID_HEX,
      sri: VALID_SRI,
      dryRun: false,
      splitRoot: tmp,
    });
    expect(second.every((entry) => !entry.changed)).toBe(true);
  });

  it("parses sync CLI flags cleanly", () => {
    const parsed = parseSyncArgs([
      "sync",
      "--version",
      "2.3.1",
      "--sha256",
      VALID_HEX,
      "--sri",
      VALID_SRI,
      "--dry-run",
    ]);
    expect(parsed.version).toBe("2.3.1");
    expect(parsed.sha256).toBe(VALID_HEX);
    expect(parsed.sri).toBe(VALID_SRI);
    expect(parsed.dryRun).toBe(true);

    const eqParsed = parseSyncArgs([
      "sync",
      `--version=2.3.1`,
      `--sha256=${VALID_HEX}`,
      `--sri=${VALID_SRI}`,
    ]);
    expect(eqParsed.sri).toBe(VALID_SRI);
    expect(eqParsed.dryRun).toBe(false);
  });
});
