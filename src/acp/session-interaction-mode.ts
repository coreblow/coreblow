import type { SessionEntry } from "../config/sessions/types.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";

type SessionInteractionEntry = Pick<SessionEntry, "spawnedBy" | "parentSessionKey" | "acp">;

export function isParentOwnedBackgroundAcpSession(
  entry?: SessionInteractionEntry | null,
): boolean {
  return Boolean(
    entry?.acp &&
    (normalizeOptionalString(entry.spawnedBy) || normalizeOptionalString(entry.parentSessionKey)),
  );
}

export function isRequesterParentOfBackgroundAcpSession(
  entry: SessionInteractionEntry | null | undefined,
  requesterSessionKey: string | null | undefined,
): boolean {
  if (!isParentOwnedBackgroundAcpSession(entry)) {
    return false;
  }
  const requester = normalizeOptionalString(requesterSessionKey);
  if (!requester) {
    return false;
  }
  return (
    requester === normalizeOptionalString(entry?.spawnedBy) ||
    requester === normalizeOptionalString(entry?.parentSessionKey)
  );
}
