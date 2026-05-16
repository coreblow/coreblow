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
}

const DEFAULT_SETTINGS: UiSettings = {
  gatewayUrl: "ws://127.0.0.1:18789",
  token: "",
  sessionKey: "",
  theme: "core",
  themeMode: "system",
  splitRatio: 0.5,
};

export function loadSettings(): UiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      locale: isSupportedLocale(parsed?.locale) ? parsed.locale : undefined,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: UiSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}
