#!/usr/bin/env node

/**
 * CoreBlow — Automated Release-Sync Contract Gate
 *
 * Verifies that monorepo surfaces stay aligned on version, docs, brand sovereignty,
 * and required release assets. Zero external dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const errors = [];

function recordError(category, message) {
  errors.push(`[${category}] ${message}`);
}

// ─── 1. Version Alignment Check ──────────────────────────────────────

const rootPkgPath = path.join(repoRoot, "package.json");
let targetVersion = "";

try {
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf-8"));
  targetVersion = rootPkg.version;
  if (!targetVersion) {
    recordError("VERSION", "package.json does not define a 'version' field");
  }
} catch (err) {
  recordError("VERSION", `Failed to read package.json: ${err.message}`);
}

if (targetVersion) {
  // apps/desktop/package.json
  const desktopPkgPath = path.join(repoRoot, "apps/desktop/package.json");
  try {
    const desktopPkg = JSON.parse(fs.readFileSync(desktopPkgPath, "utf-8"));
    if (desktopPkg.version !== targetVersion) {
      recordError(
        "VERSION",
        `apps/desktop/package.json version (${desktopPkg.version}) does not match root (${targetVersion})`
      );
    }
  } catch (err) {
    recordError("VERSION", `Failed to read apps/desktop/package.json: ${err.message}`);
  }

  // ui/package.json
  const uiPkgPath = path.join(repoRoot, "ui/package.json");
  try {
    const uiPkg = JSON.parse(fs.readFileSync(uiPkgPath, "utf-8"));
    if (uiPkg.version !== targetVersion) {
      recordError(
        "VERSION",
        `ui/package.json version (${uiPkg.version}) does not match root (${targetVersion})`
      );
    }
  } catch (err) {
    recordError("VERSION", `Failed to read ui/package.json: ${err.message}`);
  }

  // apps/desktop/src/components/StatusBar.tsx
  const statusBarPath = path.join(repoRoot, "apps/desktop/src/components/StatusBar.tsx");
  try {
    const statusBarContent = fs.readFileSync(statusBarPath, "utf-8");
    const match = statusBarContent.match(/version\s*=\s*"v([^"]+)"/);
    if (!match) {
      recordError("VERSION", "apps/desktop/src/components/StatusBar.tsx missing default version assignment");
    } else if (match[1] !== targetVersion) {
      recordError(
        "VERSION",
        `apps/desktop/src/components/StatusBar.tsx version (v${match[1]}) does not match root (${targetVersion})`
      );
    }
  } catch (err) {
    recordError("VERSION", `Failed to read apps/desktop/src/components/StatusBar.tsx: ${err.message}`);
  }

  // apps/desktop/src/components/SettingsModal.tsx
  const settingsModalPath = path.join(repoRoot, "apps/desktop/src/components/SettingsModal.tsx");
  try {
    const settingsModalContent = fs.readFileSync(settingsModalPath, "utf-8");
    const match = settingsModalContent.match(/Version\s+([0-9]+\.[0-9]+\.[0-9]+(?:\.[0-9]+)?(?:-[a-zA-Z0-9.]+)?)\s+\(Release\)/);
    if (!match) {
      recordError("VERSION", "apps/desktop/src/components/SettingsModal.tsx missing Version (Release) text");
    } else if (match[1] !== targetVersion) {
      recordError(
        "VERSION",
        `apps/desktop/src/components/SettingsModal.tsx version (${match[1]}) does not match root (${targetVersion})`
      );
    }
  } catch (err) {
    recordError("VERSION", `Failed to read apps/desktop/src/components/SettingsModal.tsx: ${err.message}`);
  }

  // scripts/install.sh
  const installShPath = path.join(repoRoot, "scripts/install.sh");
  try {
    const installContent = fs.readFileSync(installShPath, "utf-8");
    const match = installContent.match(/COREBLOW_VERSION="\$\{COREBLOW_VERSION:-([^"}]+)\}"/);
    if (!match) {
      recordError("VERSION", "scripts/install.sh missing COREBLOW_VERSION default assignment");
    } else if (match[1] !== targetVersion) {
      recordError(
        "VERSION",
        `scripts/install.sh COREBLOW_VERSION default (${match[1]}) does not match root (${targetVersion})`
      );
    }
  } catch (err) {
    recordError("VERSION", `Failed to read scripts/install.sh: ${err.message}`);
  }

  // apps/macos/scripts/package-release.sh
  const macosPkgShPath = path.join(repoRoot, "apps/macos/scripts/package-release.sh");
  try {
    const macosShContent = fs.readFileSync(macosPkgShPath, "utf-8");
    const verMatch = macosShContent.match(/^VERSION="([^"]+)"/m);
    if (!verMatch) {
      recordError("VERSION", "apps/macos/scripts/package-release.sh missing VERSION assignment");
    } else if (verMatch[1] !== targetVersion) {
      recordError(
        "VERSION",
        `apps/macos/scripts/package-release.sh VERSION (${verMatch[1]}) does not match root (${targetVersion})`
      );
    }

    const shortVerMatch = macosShContent.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/);
    if (!shortVerMatch) {
      recordError("VERSION", "apps/macos/scripts/package-release.sh missing CFBundleShortVersionString plist tag");
    } else if (shortVerMatch[1] !== targetVersion) {
      recordError(
        "VERSION",
        `apps/macos/scripts/package-release.sh CFBundleShortVersionString (${shortVerMatch[1]}) does not match root (${targetVersion})`
      );
    }
  } catch (err) {
    recordError("VERSION", `Failed to read apps/macos/scripts/package-release.sh: ${err.message}`);
  }

  // appcast.xml
  const appcastPath = path.join(repoRoot, "appcast.xml");
  try {
    const appcastContent = fs.readFileSync(appcastPath, "utf-8");
    const appcastMatch = appcastContent.match(/<sparkle:shortVersionString>([^<]+)<\/sparkle:shortVersionString>/);
    if (!appcastMatch) {
      recordError("VERSION", "appcast.xml missing sparkle:shortVersionString tag");
    } else if (appcastMatch[1] !== targetVersion) {
      recordError(
        "VERSION",
        `appcast.xml sparkle:shortVersionString (${appcastMatch[1]}) does not match root (${targetVersion})`
      );
    }
  } catch (err) {
    recordError("VERSION", `Failed to read appcast.xml: ${err.message}`);
  }

  // CHANGELOG.md
  const changelogPath = path.join(repoRoot, "CHANGELOG.md");
  try {
    const changelogContent = fs.readFileSync(changelogPath, "utf-8");
    const escapedVersion = targetVersion.replace(/\./g, "\\.");
    const headingRegex = new RegExp(`^##\\s+\\[${escapedVersion}\\]`, "m");
    if (!headingRegex.test(changelogContent)) {
      recordError(
        "VERSION",
        `CHANGELOG.md does not contain heading for ## [${targetVersion}]`
      );
    }
  } catch (err) {
    recordError("VERSION", `Failed to read CHANGELOG.md: ${err.message}`);
  }
}

// ─── 2. Personal Filesystem Path Check ───────────────────────────────

const personalPathRegex = /\/Users\/[a-zA-Z0-9_-]+/;

function checkFileForPersonalPaths(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (personalPathRegex.test(lines[i])) {
        const relPath = path.relative(repoRoot, filePath);
        recordError("PERSONAL_PATH", `${relPath}:${i + 1} contains hardcoded personal filesystem path`);
      }
    }
  } catch (err) {
    if (err.code !== "ENOENT" && err.code !== "EISDIR") {
      recordError("PERSONAL_PATH", `Failed reading ${filePath}: ${err.message}`);
    }
  }
}

function scanDirForPersonalPaths(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") {
      continue;
    }
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      scanDirForPersonalPaths(fullPath);
    } else if (entry.isFile()) {
      checkFileForPersonalPaths(fullPath);
    }
  }
}

// Scan package.json, scripts/, apps/macos/scripts/
checkFileForPersonalPaths(rootPkgPath);
scanDirForPersonalPaths(path.join(repoRoot, "scripts"));
scanDirForPersonalPaths(path.join(repoRoot, "apps/macos/scripts"));

// ─── 3. Forbidden Third-Party Brand Strings ──────────────────────────

const forbiddenBrands = [
  "openclaw",
  "clawhub",
  "hermes",
  "langchain",
  "autogen",
  "crewai",
  "eliza",
];

const brandCheckFiles = [
  "package.json",
  "README.md",
  "docs/ARCHITECTURE.md",
  "appcast.xml",
];

for (const relFile of brandCheckFiles) {
  const fullPath = path.join(repoRoot, relFile);
  if (!fs.existsSync(fullPath)) {
    recordError("BRAND", `Required file ${relFile} does not exist for brand check`);
    continue;
  }
  const content = fs.readFileSync(fullPath, "utf-8");
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].toLowerCase();
    for (const brand of forbiddenBrands) {
      if (lineLower.includes(brand)) {
        recordError(
          "BRAND",
          `${relFile}:${i + 1} contains forbidden third-party brand "${brand}": "${lines[i].trim()}"`
        );
      }
    }
  }
}

// ─── 4. Required Release Assets ──────────────────────────────────────

const requiredAssets = [
  "apps/macos/CoreBlow.entitlements",
  "coreblow.mjs",
];

for (const relAsset of requiredAssets) {
  const fullAssetPath = path.join(repoRoot, relAsset);
  if (!fs.existsSync(fullAssetPath)) {
    recordError("ASSETS", `Missing required release asset: ${relAsset}`);
  }
}

// ─── 5. Excluded Extension Import Regression Guard ────────────────────

try {
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf-8"));
  const excludedExtensionDirs = new Set();
  if (Array.isArray(rootPkg.files)) {
    for (const pattern of rootPkg.files) {
      if (typeof pattern !== "string") continue;
      const match = pattern.match(/^!extensions\/([^/*]+)\/\*\*$/);
      if (match?.[1]) {
        excludedExtensionDirs.add(match[1]);
      }
    }
  }

  const skippedDirNames = new Set([
    "node_modules",
    "dist",
    "__tests__",
    "test-fixtures",
    "test-support",
    "test-utils",
    "test-helpers",
  ]);
  const testFilePattern = /\.(test|spec|test-support|test-helpers|test-harness|e2e)\./;
  const importPattern =
    /(?:from\s+["']|import\s*\(\s*["']|import\s+["']|require\s*\(\s*["'])([^"']*extensions\/([^/"']+)\/[^"']*)["']/g;

  const scanNonTestSrcFiles = (dirPath) => {
    if (!fs.existsSync(dirPath)) return;
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || skippedDirNames.has(entry.name)) continue;
      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.relative(repoRoot, fullPath).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        if (relPath === "src/channels/plugins/contracts") continue;
        scanNonTestSrcFiles(fullPath);
        continue;
      }
      if (!/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)) continue;
      if (testFilePattern.test(entry.name) || entry.name.endsWith("-test-helpers.ts")) continue;

      const content = fs.readFileSync(fullPath, "utf-8");
      importPattern.lastIndex = 0;
      let match;
      while ((match = importPattern.exec(content)) !== null) {
        const importSpecifier = match[1];
        const extName = match[2];
        if (!excludedExtensionDirs.has(extName)) continue;
        const lineNumber = content.slice(0, match.index).split("\n").length;
        recordError(
          "PACKAGING_BOUNDARY",
          `${relPath}:${lineNumber} imports npm-excluded extension "${extName}" (${importSpecifier})`
        );
      }
    }
  };

  scanNonTestSrcFiles(path.join(repoRoot, "src"));
  scanNonTestSrcFiles(path.join(repoRoot, "packages"));
} catch (err) {
  recordError("PACKAGING_BOUNDARY", `Failed excluded-extension import scan: ${err.message}`);
}

// ─── Result Reporting ────────────────────────────────────────────────

if (errors.length > 0) {
  console.error(`\x1b[31mRelease-sync contract check failed with ${errors.length} error(s):\x1b[0m\n`);
  for (const err of errors) {
    console.error(`  ✖ ${err}`);
  }
  console.error("");
  process.exit(1);
} else {
  console.log(
    `\x1b[32m✓ Release-sync contract verified for CoreBlow v${targetVersion} (versions, paths, brand sovereignty, release assets)\x1b[0m`
  );
  process.exit(0);
}
