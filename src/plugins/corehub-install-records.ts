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
  fields: CoreHubPluginInstallRecordFields,
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
  return {
    source: "corehub",
    corehubUrl: fields.corehubUrl,
    corehubPackage: fields.corehubPackage,
    corehubFamily: fields.corehubFamily,
    ...(fields.corehubChannel ? { corehubChannel: fields.corehubChannel } : {}),
    ...(fields.version ? { version: fields.version } : {}),
    ...(fields.integrity ? { integrity: fields.integrity } : {}),
    ...(fields.resolvedAt ? { resolvedAt: fields.resolvedAt } : {}),
    ...(fields.installedAt ? { installedAt: fields.installedAt } : {}),
    ...(fields.artifactKind ? { artifactKind: fields.artifactKind } : {}),
    ...(fields.artifactFormat ? { artifactFormat: fields.artifactFormat } : {}),
    ...(fields.npmIntegrity ? { npmIntegrity: fields.npmIntegrity } : {}),
    ...(fields.npmShasum ? { npmShasum: fields.npmShasum } : {}),
    ...(fields.npmTarballName ? { npmTarballName: fields.npmTarballName } : {}),
    ...(fields.artifactSha256 ? { artifactSha256: fields.artifactSha256 } : {}),
    ...(fields.artifactSize !== undefined ? { artifactSize: fields.artifactSize } : {}),
    ...(fields.artifactManifestVerified !== undefined
      ? { artifactManifestVerified: fields.artifactManifestVerified }
      : {}),
    ...(fields.artifactManifestSha256
      ? { artifactManifestSha256: fields.artifactManifestSha256 }
      : {}),
    ...(fields.artifactStorageKey ? { artifactStorageKey: fields.artifactStorageKey } : {}),
  };
}
