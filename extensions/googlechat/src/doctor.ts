function asObjectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isGoogleChatMutableAllowEntry(raw: string): boolean {
  const text = raw.trim();
  if (!text || text === "*") {
    return false;
  }
  const withoutPrefix = text.replace(/^(googlechat|google-chat|gchat):/i, "").trim();
  const withoutUsers = withoutPrefix.replace(/^users\//i, "");
  return withoutUsers.includes("@");
}

export function collectGoogleChatMutableAllowlistWarnings(scope: {
  prefix: string;
  account: Record<string, unknown>;
}): string[] {
  const lists: Array<{ pathLabel: string; list: unknown }> = [
    { pathLabel: `${scope.prefix}.groupAllowFrom`, list: scope.account.groupAllowFrom },
  ];
  const dm = asObjectRecord(scope.account.dm);
  if (dm) {
    lists.push({ pathLabel: `${scope.prefix}.dm.allowFrom`, list: dm.allowFrom });
  }
  return lists.flatMap((entry) =>
    Array.isArray(entry.list) &&
    entry.list.some((item) => isGoogleChatMutableAllowEntry(String(item)))
      ? [`${entry.pathLabel} uses mutable user names while dangerous name matching is required.`]
      : [],
  );
}
