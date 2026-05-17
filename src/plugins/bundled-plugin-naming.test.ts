import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type PluginManifestShape = {
  id?: unknown;
};

type CoreBlowPackageShape = {
  name?: unknown;
  coreblow?: {
    install?: {
      npmSpec?: unknown;
    };
    channel?: {
      id?: unknown;
    };
  };
};

type BundledPluginRecord = {
  dirName: string;
  packageName: string;
  manifestId: string;
  installNpmSpec?: string;
  channelId?: string;
};

const EXTENSIONS_ROOT = path.resolve(process.cwd(), "extensions");
const DIR_ID_EXCEPTIONS = new Map<string, string>([
  // Historical directory name kept until a wider repo cleanup is worth the churn.
  ["kimi-coding", "kimi"],
]);
const PACKAGE_NAME_EXCEPTIONS = new Set([
  // Legacy ext-* package names are still accepted until package rename migration.
  "acpx",
  "google-gemini-cli-auth",
  "minimax-portal-auth",
  "qwen-portal-auth",
  "shared",
  "test-utils",
  "voice-call",
]);
const ALLOWED_PACKAGE_SUFFIXES = [
  "",
  "-provider",
  "-plugin",
  "-speech",
  "-sandbox",
  "-media-understanding",
] as const;

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function readBundledPluginRecords(): BundledPluginRecord[] {
  return fs
    .readdirSync(EXTENSIONS_ROOT)
    .toSorted()
    .flatMap((dirName) => {
      const rootDir = path.join(EXTENSIONS_ROOT, dirName);
      const packagePath = path.join(rootDir, "package.json");
      const manifestPath = path.join(rootDir, "coreblow.plugin.json");
      if (!fs.existsSync(packagePath) || !fs.existsSync(manifestPath)) {
        return [];
      }

      const manifest = readJsonFile<PluginManifestShape>(manifestPath);
      const pkg = readJsonFile<CoreBlowPackageShape>(packagePath);
      const manifestId = normalizeText(manifest.id);
      const packageName = normalizeText(pkg.name);
      if (!manifestId || !packageName) {
        return [];
      }

      return [
        {
          dirName,
          packageName,
          manifestId,
          installNpmSpec: normalizeText(pkg.coreblow?.install?.npmSpec),
          channelId: normalizeText(pkg.coreblow?.channel?.id),
        },
      ];
    });
}

function resolveAllowedPackageNamesForId(pluginId: string): string[] {
  return ALLOWED_PACKAGE_SUFFIXES.map((suffix) => `@coreblow/${pluginId}${suffix}`);
}

function expectNoBundledPluginNamingMismatches(params: {
  message: string;
  collectMismatches: (records: BundledPluginRecord[]) => string[];
}) {
  const mismatches = params.collectMismatches(readBundledPluginRecords());
  expect(mismatches, `${params.message}\nFound: ${mismatches.join(", ") || "<none>"}`).toEqual([]);
}

describe("bundled plugin naming guardrails", () => {
  it.each([
    {
      name: "keeps bundled workspace package names anchored to the plugin id",
      message: `Bundled extension package names must stay anchored to the manifest id via @coreblow/<id> or an approved suffix (${ALLOWED_PACKAGE_SUFFIXES.join(", ")}). Update the plugin naming docs and this invariant before adding a new naming form.`,
      collectMismatches: (records: BundledPluginRecord[]) =>
        records
          .filter(({ dirName, packageName, manifestId }) => {
            if (PACKAGE_NAME_EXCEPTIONS.has(dirName)) {
              return false;
            }
            return !resolveAllowedPackageNamesForId(manifestId).includes(packageName);
          })
          .map(
            ({ dirName, packageName, manifestId }) =>
              `${dirName}: ${packageName} (id=${manifestId})`,
          ),
    },
    {
      name: "keeps bundled workspace directories aligned with the plugin id unless explicitly allowlisted",
      message:
        "Bundled extension directory names should match coreblow.plugin.json:id. If a legacy exception is unavoidable, add it to DIR_ID_EXCEPTIONS with a comment.",
      collectMismatches: (records: BundledPluginRecord[]) =>
        records
          .filter(
            ({ dirName, manifestId }) => (DIR_ID_EXCEPTIONS.get(dirName) ?? dirName) !== manifestId,
          )
          .map(({ dirName, manifestId }) => `${dirName} -> ${manifestId}`),
    },
    {
      name: "keeps bundled coreblow.install.npmSpec aligned with the package name",
      message:
        "Bundled coreblow.install.npmSpec values must match the package name so install/update paths stay deterministic.",
      collectMismatches: (records: BundledPluginRecord[]) =>
        records
          .filter(
            ({ installNpmSpec, packageName }) =>
              typeof installNpmSpec === "string" && installNpmSpec !== packageName,
          )
          .map(
            ({ dirName, packageName, installNpmSpec }) =>
              `${dirName}: package=${packageName}, npmSpec=${installNpmSpec}`,
          ),
    },
    {
      name: "keeps bundled channel ids aligned with the canonical plugin id",
      message:
        "Bundled coreblow.channel.id values must match coreblow.plugin.json:id for the owning plugin.",
      collectMismatches: (records: BundledPluginRecord[]) =>
        records
          .filter(
            ({ channelId, manifestId }) =>
              typeof channelId === "string" && channelId !== manifestId,
          )
          .map(
            ({ dirName, manifestId, channelId }) =>
              `${dirName}: channel=${channelId}, id=${manifestId}`,
          ),
    },
  ] as const)("$name", ({ message, collectMismatches }) => {
    expectNoBundledPluginNamingMismatches({
      message,
      collectMismatches,
    });
  });
});
