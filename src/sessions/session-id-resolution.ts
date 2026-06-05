import type { SessionEntry } from "../config/sessions.js";
import { toAgentRequestSessionKey } from "../routing/session-key.js";

function freshestUniqueSessionKey(matches: Array<[string, SessionEntry]>): string | undefined {
  const sortedMatches = [...matches].toSorted(
    (a, b) => (b[1]?.updatedAt ?? 0) - (a[1]?.updatedAt ?? 0),
  );
  const [freshest, secondFreshest] = sortedMatches;
  if ((freshest?.[1]?.updatedAt ?? 0) > (secondFreshest?.[1]?.updatedAt ?? 0)) {
    return freshest?.[0].toLowerCase();
  }
  return undefined;
}

export function resolvePreferredSessionKeyForSessionIdMatches(
  matches: Array<[string, SessionEntry]>,
  sessionId: string,
): string | undefined {
  if (matches.length === 0) {
    return undefined;
  }
  if (matches.length === 1) {
    return matches[0][0];
  }

  const loweredSessionId = sessionId.trim().toLowerCase();
  const structuralMatches = matches.filter(([storeKey]) => {
    const requestKey = toAgentRequestSessionKey(storeKey)?.toLowerCase();
    return (
      storeKey.toLowerCase().endsWith(`:${loweredSessionId}`) ||
      requestKey === loweredSessionId ||
      requestKey?.endsWith(`:${loweredSessionId}`) === true
    );
  });
  if (structuralMatches.length > 0) {
    const uniqueStructuralKeys = new Set(
      structuralMatches.map(([sessionKey]) => sessionKey.toLowerCase()),
    );
    if (uniqueStructuralKeys.size === 1) {
      return [...uniqueStructuralKeys][0];
    }
    return freshestUniqueSessionKey(structuralMatches);
  }

  return freshestUniqueSessionKey(matches);
}

export function resolveSessionIdMatchSelection(
  matches: Array<[string, SessionEntry]>,
  sessionId: string,
):
  | { kind: "none" }
  | { kind: "selected"; sessionKey: string }
  | { kind: "ambiguous"; sessionKeys: string[] } {
  const selected = resolvePreferredSessionKeyForSessionIdMatches(matches, sessionId);
  if (selected) {
    return { kind: "selected", sessionKey: selected };
  }
  if (matches.length === 0) {
    return { kind: "none" };
  }
  const sortedMatches = [...matches].toSorted(
    (a, b) => (b[1]?.updatedAt ?? 0) - (a[1]?.updatedAt ?? 0),
  );
  const freshestUpdatedAt = sortedMatches[0]?.[1]?.updatedAt ?? 0;
  return {
    kind: "ambiguous",
    sessionKeys: sortedMatches
      .filter((entry) => (entry[1]?.updatedAt ?? 0) === freshestUpdatedAt)
      .map(([sessionKey]) => sessionKey),
  };
}
