import process from "node:process";

export const OCTOPUS_PALETTE = {
  ".": null,
  O: "#3A140A",
  B: "#F25C3B",
  S: "#D13B1E",
  H: "#FFA88A",
  E: "#260D08",
  W: "#FFFFFF",
} as const satisfies Record<string, string | null>;

export type OctopusPaletteKey = keyof typeof OCTOPUS_PALETTE;
export type OctopusVariant = "standard" | "compact";

export interface PixelSegment {
  char: string;
  color?: string;
  backgroundColor?: string;
}

export interface RenderPixelGridOptions {
  monochrome?: boolean;
}

/**
 * 16x16 CoreBlow pixel octopus (renders as 8 terminal half-block rows).
 */
export const OCTOPUS_STANDARD_GRID: readonly string[] = [
  ".....OOOOOO.....",
  "...OOHBBBBBOO...",
  "..OHHBBBBBBSSO..",
  ".OHBBBBBBBBBBBO.",
  ".OBBBBBBBSSBBBO.",
  "OOBBBBBBBBSBBBOO",
  "OBBBBWEBBWEBBBBO",
  "OBBBBEEBBEEBBBBO",
  "OBBBBBBBBBBBBBBO",
  ".OBBBSSSSSSBBBO.",
  ".OOBBBBBBBBBBOO.",
  "OBBO.OBBBBO.OBBO",
  "OBO.OBO..OBO.OBO",
  ".OO.OBS..SBO.OO.",
  "....OBO..OBO....",
  ".....OO..OO.....",
];

/**
 * 12x10 compact CoreBlow pixel octopus (renders as 5 terminal half-block rows).
 */
export const OCTOPUS_COMPACT_GRID: readonly string[] = [
  "...OOOOOO...",
  ".OOHBBBBBOO.",
  ".OHBBBBSSBO.",
  ".OBBBBBBBBO.",
  "OBBWEBBWEBBO",
  "OBBEEBBEEBBO",
  ".OBSSSSSSBO.",
  ".OOBBBBBBOO.",
  "OBO.OBBO.OBO",
  ".OO..OO..OO.",
];

export function selectOctopusGrid(columns: number): {
  variant: OctopusVariant;
  grid: readonly string[];
  width: number;
} {
  if (columns >= 72) {
    return { variant: "standard", grid: OCTOPUS_STANDARD_GRID, width: 16 };
  }
  return { variant: "compact", grid: OCTOPUS_COMPACT_GRID, width: 12 };
}

export function isMonochromeMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.NO_COLOR && env.NO_COLOR !== "0");
}

function resolvePaletteColor(symbol: string | undefined): string | null {
  if (!symbol || !(symbol in OCTOPUS_PALETTE)) {
    return null;
  }
  return OCTOPUS_PALETTE[symbol as OctopusPaletteKey];
}

function pairToSegment(
  top: string | null,
  bottom: string | null,
  monochrome: boolean,
): PixelSegment {
  if (top === null && bottom === null) {
    return { char: " " };
  }
  if (monochrome) {
    if (top !== null && bottom === null) {
      return { char: "▀" };
    }
    if (top === null && bottom !== null) {
      return { char: "▄" };
    }
    return { char: "█" };
  }
  if (top !== null && bottom === null) {
    return { char: "▀", color: top };
  }
  if (top === null && bottom !== null) {
    return { char: "▄", color: bottom };
  }
  if (top === bottom) {
    return { char: "█", color: top! };
  }
  return { char: "▀", color: top!, backgroundColor: bottom! };
}

function hasSameSegmentStyle(a: PixelSegment, b: PixelSegment): boolean {
  return a.color === b.color && a.backgroundColor === b.backgroundColor;
}

/**
 * Converts an even-row pixel art grid into compact Unicode half-block segments
 * with transparent cells preserved cleanly across Light and Dark terminals.
 */
export function renderPixelGridRows(
  grid: readonly string[],
  options: RenderPixelGridOptions = {},
): PixelSegment[][] {
  const monochrome = options.monochrome ?? isMonochromeMode();
  const rows: PixelSegment[][] = [];

  for (let rowIndex = 0; rowIndex < grid.length; rowIndex += 2) {
    const topRow = grid[rowIndex] ?? "";
    const bottomRow = grid[rowIndex + 1] ?? "";
    const width = Math.max(topRow.length, bottomRow.length);
    const mergedSegments: PixelSegment[] = [];

    for (let col = 0; col < width; col += 1) {
      const top = resolvePaletteColor(topRow[col]);
      const bottom = resolvePaletteColor(bottomRow[col]);
      const nextSeg = pairToSegment(top, bottom, monochrome);

      const prevSeg = mergedSegments.at(-1);
      if (prevSeg && hasSameSegmentStyle(prevSeg, nextSeg)) {
        prevSeg.char += nextSeg.char;
      } else {
        mergedSegments.push(nextSeg);
      }
    }

    rows.push(mergedSegments);
  }

  return rows;
}
