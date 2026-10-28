import {
  COREHUB_INSTALL_ERROR_CODE,
  formatCoreHubSpecifier,
  installPluginFromCoreHub,
  verifyCoreHubInstalledTrustRecord,
  type CoreHubInstallErrorCode,
  type CoreHubInstalledTrustRecord,
  type CoreHubInstalledTrustVerificationResult,
  type CoreHubPluginInstallRecordFields,
} from "./corehub.js";
import type { InstallPluginResult } from "./install.js";

export const CLAWHUB_INSTALL_ERROR_CODE = COREHUB_INSTALL_ERROR_CODE;

export type ClawHubInstallErrorCode = CoreHubInstallErrorCode;
export type ClawHubPluginInstallRecordFields = CoreHubPluginInstallRecordFields;
export type ClawHubInstalledTrustRecord = CoreHubInstalledTrustRecord;
export type ClawHubInstalledTrustVerificationResult = CoreHubInstalledTrustVerificationResult;

function normalizeLegacyClawHubSpec(spec: string): string {
  const trimmed = spec.trim();
  if (trimmed.toLowerCase().startsWith("clawhub:")) {
    return `corehub:${trimmed.slice("clawhub:".length).trim()}`;
  }
  return trimmed;
}

export function formatClawHubSpecifier(params: { name: string; version?: string }): string {
  return formatCoreHubSpecifier(params);
}

export type InstallPluginFromClawHubResult =
  | ({
      ok: true;
    } & Extract<InstallPluginResult, { ok: true }> & {
        clawhub: ClawHubPluginInstallRecordFields;
        packageName: string;
      })
  | Extract<Awaited<ReturnType<typeof installPluginFromCoreHub>>, { ok: false }>;

export async function installPluginFromClawHub(
  params: Parameters<typeof installPluginFromCoreHub>[0],
): Promise<InstallPluginFromClawHubResult> {
  const result = await installPluginFromCoreHub({
    ...params,
    spec: normalizeLegacyClawHubSpec(params.spec),
  });
  if (result.ok && "corehub" in result) {
    return {
      ...result,
      clawhub: result.corehub,
    };
  }
  return result as InstallPluginFromClawHubResult;
}

export const verifyClawHubInstalledTrustRecord = verifyCoreHubInstalledTrustRecord;
