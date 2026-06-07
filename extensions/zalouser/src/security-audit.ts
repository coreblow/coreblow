import { isDangerousNameMatchingEnabled } from "coreblow/plugin-sdk/zalouser";
import type { ResolvedZalouserAccount } from "./accounts.js";

export function isZalouserMutableGroupEntry(raw: string): boolean {
  const text = raw.trim();
  if (!text || text === "*") {
    return false;
  }
  const normalized = text
    .replace(/^(zalouser|zlu):/i, "")
    .replace(/^group:/i, "")
    .trim();
  if (!normalized) {
    return false;
  }
  if (/^\d+$/.test(normalized)) {
    return false;
  }
  return !/^g-\S+$/i.test(normalized);
}

export function collectZalouserSecurityAuditFindings(params: {
  accountId?: string | null;
  account: ResolvedZalouserAccount;
  orderedAccountIds: string[];
  hasExplicitAccountPath: boolean;
}) {
  const zalouserCfg = params.account.config ?? {};
  const accountId = params.accountId?.trim() || params.account.accountId || "default";
  const dangerousNameMatchingEnabled = isDangerousNameMatchingEnabled(zalouserCfg);
  const zalouserPathPrefix =
    params.orderedAccountIds.length > 1 || params.hasExplicitAccountPath
      ? `channels.zalouser.accounts.${accountId}`
      : "channels.zalouser";
  const mutableGroupEntries = new Set<string>();
  const groups = zalouserCfg.groups;
  if (groups && typeof groups === "object" && !Array.isArray(groups)) {
    for (const key of Object.keys(groups as Record<string, unknown>)) {
      if (isZalouserMutableGroupEntry(key)) {
        mutableGroupEntries.add(`${zalouserPathPrefix}.groups:${key}`);
      }
    }
  }
  if (mutableGroupEntries.size === 0) {
    return [];
  }
  const examples = Array.from(mutableGroupEntries).slice(0, 5);
  const severity: "info" | "warn" = dangerousNameMatchingEnabled ? "info" : "warn";
  return [
    {
      checkId: "channels.zalouser.groups.mutable_entries",
      severity,
      title: dangerousNameMatchingEnabled
        ? "Zalouser group routing uses break-glass name matching"
        : "Zalouser group routing contains mutable group entries",
      detail: `Found: ${examples.join(", ")}.`,
      remediation:
        "Prefer stable Zalo group IDs in channels.zalouser.groups, or explicitly opt in with dangerouslyAllowNameMatching=true if you accept mutable group-name matching.",
    },
  ];
}
