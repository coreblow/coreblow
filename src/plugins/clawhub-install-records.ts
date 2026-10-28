import type { PluginInstallRecord } from "../config/types.plugins.js";
import type { ClawHubPackageChannel, ClawHubPackageFamily } from "../infra/clawhub.js";
import type { CoreHubPluginInstallRecordFields } from "./corehub-install-records.js";

export type ClawHubPluginInstallRecordFields = {
  source: "clawhub";
  clawhubUrl: string;
  clawhubPackage: string;
  clawhubFamily: Exclude<ClawHubPackageFamily, "skill">;
  clawhubChannel?: ClawHubPackageChannel;
  version?: string;
  integrity?: string;
  resolvedAt?: string;
  installedAt?: string;
  artifactKind?: "legacy-zip" | "npm-pack";
  artifactFormat?: "zip" | "tgz";
  npmIntegrity?: string;
  npmShasum?: string;
  npmTarballName?: string;
  clawpackSha256?: string;
  clawpackSpecVersion?: number;
  clawpackManifestSha256?: string;
  clawpackSize?: number;
};

export function buildClawHubPluginInstallRecordFields(
  fields: ClawHubPluginInstallRecordFields | CoreHubPluginInstallRecordFields,
): Pick<
  PluginInstallRecord,
  | "source"
  | "clawhubUrl"
  | "clawhubPackage"
  | "clawhubFamily"
  | "clawhubChannel"
  | "version"
  | "integrity"
  | "resolvedAt"
  | "installedAt"
  | "artifactKind"
  | "artifactFormat"
  | "npmIntegrity"
  | "npmShasum"
  | "npmTarballName"
  | "clawpackSha256"
  | "clawpackSpecVersion"
  | "clawpackManifestSha256"
  | "clawpackSize"
> {
  const isCoreHub = (f: unknown): f is CoreHubPluginInstallRecordFields =>
    typeof f === "object" && f !== null && (f as { source?: string }).source === "corehub";
  if (isCoreHub(fields)) {
    return {
      source: "clawhub",
      clawhubUrl: fields.corehubUrl,
      clawhubPackage: fields.corehubPackage,
      clawhubFamily: fields.corehubFamily,
      ...(fields.corehubChannel ? { clawhubChannel: fields.corehubChannel } : {}),
      ...(fields.version ? { version: fields.version } : {}),
      ...(fields.integrity ? { integrity: fields.integrity } : {}),
      ...(fields.resolvedAt ? { resolvedAt: fields.resolvedAt } : {}),
      ...(fields.installedAt ? { installedAt: fields.installedAt } : {}),
      ...(fields.artifactKind ? { artifactKind: fields.artifactKind } : {}),
      ...(fields.artifactFormat ? { artifactFormat: fields.artifactFormat } : {}),
      ...(fields.npmIntegrity ? { npmIntegrity: fields.npmIntegrity } : {}),
      ...(fields.npmShasum ? { npmShasum: fields.npmShasum } : {}),
      ...(fields.npmTarballName ? { npmTarballName: fields.npmTarballName } : {}),
      ...(fields.artifactSha256 ? { clawpackSha256: fields.artifactSha256 } : {}),
      ...(fields.artifactManifestSha256 ? { clawpackManifestSha256: fields.artifactManifestSha256 } : {}),
      ...(fields.artifactSize !== undefined ? { clawpackSize: fields.artifactSize } : {}),
    };
  }
  return {
    source: "clawhub",
    clawhubUrl: fields.clawhubUrl,
    clawhubPackage: fields.clawhubPackage,
    clawhubFamily: fields.clawhubFamily,
    ...(fields.clawhubChannel ? { clawhubChannel: fields.clawhubChannel } : {}),
    ...(fields.version ? { version: fields.version } : {}),
    ...(fields.integrity ? { integrity: fields.integrity } : {}),
    ...(fields.resolvedAt ? { resolvedAt: fields.resolvedAt } : {}),
    ...(fields.installedAt ? { installedAt: fields.installedAt } : {}),
    ...(fields.artifactKind ? { artifactKind: fields.artifactKind } : {}),
    ...(fields.artifactFormat ? { artifactFormat: fields.artifactFormat } : {}),
    ...(fields.npmIntegrity ? { npmIntegrity: fields.npmIntegrity } : {}),
    ...(fields.npmShasum ? { npmShasum: fields.npmShasum } : {}),
    ...(fields.npmTarballName ? { npmTarballName: fields.npmTarballName } : {}),
    ...(fields.clawpackSha256 ? { clawpackSha256: fields.clawpackSha256 } : {}),
    ...(fields.clawpackSpecVersion !== undefined
      ? { clawpackSpecVersion: fields.clawpackSpecVersion }
      : {}),
    ...(fields.clawpackManifestSha256
      ? { clawpackManifestSha256: fields.clawpackManifestSha256 }
      : {}),
    ...(fields.clawpackSize !== undefined ? { clawpackSize: fields.clawpackSize } : {}),
  };
}
