import { readFileSync } from "node:fs";
import { normalizeResolvedSecretInputString } from "./secret-input.js";

export function resolveNextcloudTalkApiCredentials(params: {
  apiUser?: string;
  apiPassword?: unknown;
  apiPasswordFile?: string;
}): { apiUser: string; apiPassword: string } | undefined {
  const apiUser = params.apiUser?.trim();
  if (!apiUser) {
    return undefined;
  }
  const inline = normalizeResolvedSecretInputString({
    value: params.apiPassword,
    path: "channels.nextcloud-talk.apiPassword",
  });
  if (inline) {
    return { apiUser, apiPassword: inline };
  }
  if (!params.apiPasswordFile) {
    return undefined;
  }
  try {
    const apiPassword = readFileSync(params.apiPasswordFile, "utf8").trim();
    return apiPassword ? { apiUser, apiPassword } : undefined;
  } catch {
    return undefined;
  }
}
