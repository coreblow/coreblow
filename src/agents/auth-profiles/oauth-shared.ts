import type { OAuthCredential } from "./types.js";

function normalizeAuthIdentityToken(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeAuthEmailToken(value: unknown): string | undefined {
  const normalized = normalizeAuthIdentityToken(value);
  return normalized ? normalized.toLowerCase() : undefined;
}

export function areOAuthCredentialsEquivalent(
  a: OAuthCredential | undefined,
  b: OAuthCredential,
): boolean {
  if (!a) {
    return false;
  }
  if (a.type !== "oauth") {
    return false;
  }
  return (
    a.provider === b.provider &&
    a.access === b.access &&
    a.refresh === b.refresh &&
    a.expires === b.expires &&
    a.email === b.email &&
    a.enterpriseUrl === b.enterpriseUrl &&
    a.projectId === b.projectId &&
    a.accountId === b.accountId
  );
}

export function hasUsableOAuthCredential(
  credential: OAuthCredential | undefined,
  now = Date.now(),
): boolean {
  if (!credential || credential.type !== "oauth") {
    return false;
  }
  if (typeof credential.access !== "string" || credential.access.trim().length === 0) {
    return false;
  }
  if (typeof credential.expires !== "number" || !Number.isFinite(credential.expires)) {
    return false;
  }
  return now < credential.expires;
}

export function isSafeToAdoptMainStoreOAuthIdentity(
  local: OAuthCredential | undefined,
  main: OAuthCredential,
): boolean {
  if (!local || local.type !== "oauth") {
    return true;
  }
  if (local.provider !== main.provider) {
    return false;
  }

  const localAccountId = normalizeAuthIdentityToken(local.accountId);
  const mainAccountId = normalizeAuthIdentityToken(main.accountId);
  const localEmail = normalizeAuthEmailToken(local.email);
  const mainEmail = normalizeAuthEmailToken(main.email);

  if (localAccountId !== undefined && mainAccountId !== undefined) {
    return localAccountId === mainAccountId;
  }
  if (localEmail !== undefined && mainEmail !== undefined) {
    return localEmail === mainEmail;
  }

  const localHasIdentity = localAccountId !== undefined || localEmail !== undefined;
  return !localHasIdentity;
}
