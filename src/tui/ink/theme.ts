import { execSync } from "node:child_process";
import process from "node:process";
import chalk from "chalk";

export const inkLightPalette = {
  text: "#1C1917",
  dim: "#57534E",
  border: "#D6D3D1",
  accent: "#EA580C",
  accentSoft: "#C2410C",
  success: "#16A34A",
  error: "#DC2626",
  link: "#0D9488",
  userBg: "#F5F5F4",
  userText: "#1C1917",
} as const;

export const inkDarkPalette = {
  text: "#F5F5F4",
  dim: "#A8A29E",
  border: "#3F3F46",
  accent: "#F97316",
  accentSoft: "#FB923C",
  success: "#22C55E",
  error: "#EF4444",
  link: "#38BDF8",
  userBg: "#27272A",
  userText: "#F5F5F4",
} as const;

let cachedMacOsStyle: string | null | undefined = undefined;

export function getMacOsInterfaceStyle(): string | null {
  if (cachedMacOsStyle !== undefined) {
    return cachedMacOsStyle;
  }
  if (process.platform !== "darwin") {
    cachedMacOsStyle = null;
    return null;
  }
  try {
    const out = execSync("defaults read -g AppleInterfaceStyle", {
      timeout: 500,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    cachedMacOsStyle = out;
    return out;
  } catch {
    cachedMacOsStyle = "Light";
    return "Light";
  }
}

/**
 * Pure helper to detect if light mode should be active.
 * 1. Respects COREBLOW_THEME=light|dark first.
 * 2. Checks COLORFGBG if present.
 * 3. On macOS, checks AppleInterfaceStyle (if "Dark", returns false; otherwise returns true).
 */
export function detectLightMode(
  env: NodeJS.ProcessEnv = process.env,
  macOsStyle?: string | null,
): boolean {
  const explicit = env.COREBLOW_THEME?.toLowerCase();
  if (explicit === "light") return true;
  if (explicit === "dark") return false;

  const colorfgbg = env.COLORFGBG;
  if (colorfgbg) {
    const sep = colorfgbg.lastIndexOf(";");
    const bg = Number.parseInt(sep >= 0 ? colorfgbg.slice(sep + 1) : colorfgbg, 10);
    if (!Number.isNaN(bg)) {
      if (bg === 7 || bg === 15 || (bg >= 244 && bg <= 255)) return true;
      return false;
    }
  }

  const effectiveMacStyle =
    macOsStyle !== undefined
      ? macOsStyle
      : process.platform === "darwin"
        ? getMacOsInterfaceStyle()
        : null;

  if (effectiveMacStyle !== null) {
    if (effectiveMacStyle.trim().toLowerCase() === "dark") {
      return false;
    }
    return true;
  }

  return false;
}

export const isLight = detectLightMode();
export const inkPalette = isLight ? inkLightPalette : inkDarkPalette;

export const tuiChalk = {
  accent: chalk.hex(inkPalette.accent),
  accentSoft: chalk.hex(inkPalette.accentSoft),
  dim: chalk.hex(inkPalette.dim),
  text: chalk.hex(inkPalette.text),
  error: chalk.hex(inkPalette.error),
  success: chalk.hex(inkPalette.success),
  link: chalk.hex(inkPalette.link),
  border: chalk.hex(inkPalette.border),
  bold: chalk.bold,
};
