type CodexJwtPayload = {
  exp?: unknown;
  iss?: unknown;
  sub?: unknown;
  "https://api.openai.com/profile"?: {
    email?: unknown;
  };
  "https://api.openai.com/auth"?: {
    chatgpt_account_id?: unknown;
    chatgpt_account_user_id?: unknown;
    chatgpt_plan_type?: unknown;
    chatgpt_user_id?: unknown;
    user_id?: unknown;
  };
};

function normalizeNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeFutureEpochSeconds(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }
  return undefined;
}

export function decodeCodexJwtPayload(accessToken: string): CodexJwtPayload | null {
  const parts = accessToken.split(".");
  if (parts.length !== 3) {
    return null;
  }

  try {
    const decoded = Buffer.from(parts[1], "base64url").toString("utf8");
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === "object" ? (parsed as CodexJwtPayload) : null;
  } catch {
    return null;
  }
}

export function resolveCodexStableSubject(payload: CodexJwtPayload | null): string | undefined {
  const auth = payload?.["https://api.openai.com/auth"];
  const accountUserId = normalizeNonEmptyString(auth?.chatgpt_account_user_id);
  if (accountUserId) {
    return accountUserId;
  }

  const userId =
    normalizeNonEmptyString(auth?.chatgpt_user_id) ?? normalizeNonEmptyString(auth?.user_id);
  if (userId) {
    return userId;
  }

  const iss = normalizeNonEmptyString(payload?.iss);
  const sub = normalizeNonEmptyString(payload?.sub);
  if (iss && sub) {
    return `${iss}|${sub}`;
  }
  return sub;
}

export function resolveCodexAccessTokenExpiry(accessToken: string): number | undefined {
  const payload = decodeCodexJwtPayload(accessToken);
  const exp = normalizeFutureEpochSeconds(payload?.exp);
  return exp ? exp * 1000 : undefined;
}

export function resolveCodexAuthIdentity(params: { accessToken: string; email?: string | null }): {
  accountId?: string;
  chatgptPlanType?: string;
  email?: string;
  profileName?: string;
} {
  const payload = decodeCodexJwtPayload(params.accessToken);
  const auth = payload?.["https://api.openai.com/auth"];
  const accountId = normalizeNonEmptyString(auth?.chatgpt_account_id);
  const chatgptPlanType = normalizeNonEmptyString(auth?.chatgpt_plan_type);
  const email =
    normalizeNonEmptyString(payload?.["https://api.openai.com/profile"]?.email) ??
    normalizeNonEmptyString(params.email);
  const metadata = {
    ...(accountId ? { accountId } : {}),
    ...(chatgptPlanType ? { chatgptPlanType } : {}),
  };
  if (email) {
    return { ...metadata, email, profileName: email };
  }

  const stableSubject = resolveCodexStableSubject(payload);
  if (!stableSubject) {
    return metadata;
  }

  return {
    ...metadata,
    profileName: `id-${Buffer.from(stableSubject).toString("base64url")}`,
  };
}
