import type { PluginInstallRecord } from "../config/types.plugins.js";
import type { CoreHubPackageChannel, CoreHubPackageFamily } from "../infra/corehub.js";

export type CoreHubPluginInstallRecordFields = {
  source: "corehub";
  corehubUrl: string;
  corehubPackage: string;
  corehubFamily: Exclude<CoreHubPackageFamily, "skill">;
  corehubChannel?: CoreHubPackageChannel;
  version?: string;
  integrity?: string;
  resolvedAt?: string;
  installedAt?: string;
  artifactKind?: "legacy-zip" | "npm-pack";
  artifactFormat?: "zip" | "tgz";
  npmIntegrity?: string;
  npmShasum?: string;
  npmTarballName?: string;
  artifactSha256?: string;
  artifactSize?: number;
  artifactManifestVerified?: boolean;
  artifactManifestSha256?: string;
  artifactStorageKey?: string;
};

export function buildCoreHubPluginInstallRecordFields(
  fields: CoreHubPluginInstallRecordFields | Record<string, unknown>,
): Pick<
  PluginInstallRecord,
  | "source"
  | "corehubUrl"
  | "corehubPackage"
  | "corehubFamily"
  | "corehubChannel"
  | "version"
  | "integrity"
  | "resolvedAt"
  | "installedAt"
  | "artifactKind"
  | "artifactFormat"
  | "npmIntegrity"
  | "npmShasum"
  | "npmTarballName"
  | "artifactSha256"
  | "artifactSize"
  | "artifactManifestVerified"
  | "artifactManifestSha256"
  | "artifactStorageKey"
> {
  const f = fields as Record<string, unknown>;
  const corehubUrl = (f.corehubUrl ?? f.clawhubUrl ?? "https://coreblow.com/corehub") as string;
  const corehubPackage = (f.corehubPackage ?? f.clawhubPackage ?? "") as string;
  const corehubFamily = (f.corehubFamily ?? f.clawhubFamily ?? "code-plugin") as Exclude<
    CoreHubPackageFamily,
    "skill"
  >;
  const corehubChannel = (f.corehubChannel ?? f.clawhubChannel) as CoreHubPackageChannel | undefined;
  const source = f.source === "clawhub" ? ("clawhub" as const) : ("corehub" as const);
  return {
    source,
    corehubUrl,
    corehubPackage,
    corehubFamily,
    ...(f.source === "clawhub"
      ? {
          clawhubUrl: corehubUrl,
          clawhubPackage: corehubPackage,
          clawhubFamily: corehubFamily,
          ...(corehubChannel ? { clawhubChannel: corehubChannel } : {}),
        }
      : {}),
    ...(corehubChannel ? { corehubChannel } : {}),
    ...(f.version ? { version: f.version as string } : {}),
    ...(f.integrity ? { integrity: f.integrity as string } : {}),
    ...(f.resolvedAt ? { resolvedAt: f.resolvedAt as string } : {}),
    ...(f.installedAt ? { installedAt: f.installedAt as string } : {}),
    ...(f.artifactKind ? { artifactKind: f.artifactKind as "legacy-zip" | "npm-pack" } : {}),
    ...(f.artifactFormat ? { artifactFormat: f.artifactFormat as "zip" | "tgz" } : {}),
    ...(f.npmIntegrity ? { npmIntegrity: f.npmIntegrity as string } : {}),
    ...(f.npmShasum ? { npmShasum: f.npmShasum as string } : {}),
    ...(f.npmTarballName ? { npmTarballName: f.npmTarballName as string } : {}),
    ...(f.artifactSha256 ? { artifactSha256: f.artifactSha256 as string } : {}),
    ...(f.artifactSize !== undefined ? { artifactSize: f.artifactSize as number } : {}),
    ...(f.artifactManifestVerified !== undefined
      ? { artifactManifestVerified: f.artifactManifestVerified as boolean }
      : {}),
    ...(f.artifactManifestSha256
      ? { artifactManifestSha256: f.artifactManifestSha256 as string }
      : {}),
    ...(f.artifactStorageKey ? { artifactStorageKey: f.artifactStorageKey as string } : {}),
    ...(f.clawpackSha256 ? { clawpackSha256: f.clawpackSha256 as string } : {}),
    ...(f.clawpackSpecVersion !== undefined
      ? { clawpackSpecVersion: f.clawpackSpecVersion as number }
      : {}),
    ...(f.clawpackManifestSha256
      ? { clawpackManifestSha256: f.clawpackManifestSha256 as string }
      : {}),
    ...(f.clawpackSize !== undefined ? { clawpackSize: f.clawpackSize as number } : {}),
  };
}

export const buildClawHubPluginInstallRecordFields = buildCoreHubPluginInstallRecordFields;
export type ClawHubPluginInstallRecordFields = CoreHubPluginInstallRecordFields;
