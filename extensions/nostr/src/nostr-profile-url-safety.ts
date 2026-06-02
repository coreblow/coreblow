import { isBlockedHostnameOrIp } from "../api.js";

export function validateUrlSafety(urlStr: string): { ok: true } | { ok: false; error: string } {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "https:") {
      return { ok: false, error: "URL must use https:// protocol" };
    }
    if (isBlockedHostnameOrIp(url.hostname.trim().toLowerCase())) {
      return { ok: false, error: "URL must not point to private/internal addresses" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Invalid URL format" };
  }
}
