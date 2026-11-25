import type { ThemeMode, ThemeName } from "./theme.ts";
import { isSupportedLocale } from "../i18n/index.ts";

const STORAGE_KEY = "coreblow.control.settings.v1";

export interface UiSettings {
  gatewayUrl: string;
  token: string;
  sessionKey: string;
  lastActiveSessionKey?: string;
  theme: ThemeName;
  themeMode: ThemeMode;
  splitRatio: number;
  locale?: string;
  coreHubRegistryUrl?: string;
  coreHubActor?: string;
  coreHubToken?: string;
  connectionMode?: "local" | "remote" | "ssh";
  activeRemoteNodeId?: string;
  sshTunnelHost?: string;
  sshTunnelUser?: string;
  sshTunnelPort?: number;
  sshTunnelRemotePort?: number;
  sshTunnelIdentityFile?: string;
}

function normalizeGatewayUrl(raw?: string | null): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:") parsed.protocol = "ws:";
    if (parsed.protocol === "https:") parsed.protocol = "wss:";
    if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") return null;
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function resolveQueryGatewayUrl(): string | null {
  try {
    const search = globalThis.location?.search;
    if (!search) return null;
    const params = new URLSearchParams(search);
    return normalizeGatewayUrl(params.get("gatewayUrl"));
  } catch {
    return null;
  }
}

export function resolveDefaultGatewayUrl(): string {
  const queryUrl = resolveQueryGatewayUrl();
  if (queryUrl) return queryUrl;
  try {
    const loc = globalThis.location;
    if (loc?.host && (loc.protocol === "http:" || loc.protocol === "https:")) {
      const wsProtocol = loc.protocol === "https:" ? "wss:" : "ws:";
      return `${wsProtocol}//${loc.host}`;
    }
  } catch {
    // Fallback below when running outside a browser HTTP origin
  }
  return "ws://127.0.0.1:18789";
}

const DEFAULT_SETTINGS: UiSettings = {
  gatewayUrl: resolveDefaultGatewayUrl(),
  token: "",
  sessionKey: "",
  theme: "core",
  themeMode: "system",
  splitRatio: 0.5,
  coreHubRegistryUrl: "https://coreblow.com/corehub",
  coreHubActor: "github:coreblow-admin",
  coreHubToken: "",
  connectionMode: "local",
  activeRemoteNodeId: "local",
  sshTunnelHost: "",
  sshTunnelUser: "",
  sshTunnelPort: 22,
  sshTunnelRemotePort: 18789,
  sshTunnelIdentityFile: "~/.ssh/id_ed25519",
};

export function loadSettings(): UiSettings {
  const defaultGatewayUrl = resolveDefaultGatewayUrl();
  const queryGatewayUrl = resolveQueryGatewayUrl();
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, gatewayUrl: defaultGatewayUrl };
    const parsed = JSON.parse(raw);
    const normalizedTheme = parsed?.theme === "knot" ? "obsidian" : parsed?.theme;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      gatewayUrl: queryGatewayUrl ?? normalizeGatewayUrl(parsed?.gatewayUrl) ?? defaultGatewayUrl,
      ...(normalizedTheme ? { theme: normalizedTheme } : {}),
      locale: isSupportedLocale(parsed?.locale) ? parsed.locale : undefined,
    };
  } catch {
    return { ...DEFAULT_SETTINGS, gatewayUrl: defaultGatewayUrl };
  }
}

export function saveSettings(settings: UiSettings): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}
