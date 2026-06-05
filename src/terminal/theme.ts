import chalk, { Chalk } from "chalk";
import { COREBLOW_PALETTE } from "./palette.js";

const hasForceColor =
  typeof process.env.FORCE_COLOR === "string" &&
  process.env.FORCE_COLOR.trim().length > 0 &&
  process.env.FORCE_COLOR.trim() !== "0";

const baseChalk = process.env.NO_COLOR && !hasForceColor ? new Chalk({ level: 0 }) : chalk;

const hex = (value: string) => baseChalk.hex(value);

export const theme = {
  accent: hex(COREBLOW_PALETTE.accent),
  accentBright: hex(COREBLOW_PALETTE.accentBright),
  accentDim: hex(COREBLOW_PALETTE.accentDim),
  info: hex(COREBLOW_PALETTE.info),
  success: hex(COREBLOW_PALETTE.success),
  warn: hex(COREBLOW_PALETTE.warn),
  error: hex(COREBLOW_PALETTE.error),
  muted: hex(COREBLOW_PALETTE.muted),
  heading: baseChalk.bold.hex(COREBLOW_PALETTE.accent),
  command: hex(COREBLOW_PALETTE.accentBright),
  option: hex(COREBLOW_PALETTE.warn),
} as const;

export const isRich = () => Boolean(baseChalk.level > 0);

export const colorize = (rich: boolean, color: (value: string) => string, value: string) =>
  rich ? color(value) : value;
