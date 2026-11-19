import chalk from "chalk";
import { darkPalette, lightPalette } from "../theme/theme.js";

function isLightMode(): boolean {
  const explicit = process.env.COREBLOW_THEME?.toLowerCase();
  if (explicit === "light") return true;
  if (explicit === "dark") return false;

  const colorfgbg = process.env.COLORFGBG;
  if (colorfgbg) {
    const sep = colorfgbg.lastIndexOf(";");
    const bg = Number.parseInt(sep >= 0 ? colorfgbg.slice(sep + 1) : colorfgbg, 10);
    if (bg === 7 || bg === 15) return true;
    if (bg >= 244 && bg <= 255) return true;
  }
  return false;
}

export const isLight = isLightMode();
export const inkPalette = isLight ? lightPalette : darkPalette;

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
