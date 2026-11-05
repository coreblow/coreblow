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
}

export function getDefaultGatewayUrl(): string {
  if (typeof window !== "undefined" && window.location) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    if (window.location.host) {
      return `${proto}//${window.location.host}`;
    }
  }
  return "ws://127.0.0.1:3000";
}

const DEFAULT_SETTINGS: UiSettings = {
  gatewayUrl: getDefaultGatewayUrl(),
  token: "",
  sessionKey: "",
  theme: "core",
  themeMode: "system",
  splitRatio: 0.5,
  coreHubRegistryUrl: "https://coreblow.com/corehub",
  coreHubActor: "github:coreblow-admin",
  coreHubToken: "",
};

export function loadSettings(): UiSettings {
  const defaultUrl = getDefaultGatewayUrl();
  const defaultSettings: UiSettings = {
    ...DEFAULT_SETTINGS,
    gatewayUrl: defaultUrl,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw);
    let gatewayUrl = typeof parsed.gatewayUrl === "string" && parsed.gatewayUrl.trim()
      ? parsed.gatewayUrl.trim()
      : defaultUrl;
    // Auto-migrate legacy 18789 default if running on a different origin (e.g. port 3000)
    if (
      gatewayUrl === "ws://127.0.0.1:18789" &&
      typeof window !== "undefined" &&
      window.location?.host &&
      !window.location.host.includes("18789")
    ) {
      gatewayUrl = defaultUrl;
    }
    return {
      ...defaultSettings,
      ...parsed,
      gatewayUrl,
      locale: isSupportedLocale(parsed?.locale) ? parsed.locale : undefined,
    };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: UiSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}
