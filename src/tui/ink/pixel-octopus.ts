import process from "node:process";

export const OCTOPUS_PALETTE = {
  ".": null,
  O: "#3A140A",
  B: "#FF4B2B",
  S: "#C82D16",
  H: "#FFE1D7",
  E: "#160A0A",
  W: "#FFFFFF",
} as const satisfies Record<string, string | null>;

export const WORDMARK_ORANGE = "#FF6A00";
export const WORDMARK_WIDTH = 47; // 8 letters * 5 cols + 7 single-space gaps

export type OctopusPaletteKey = keyof typeof OCTOPUS_PALETTE;
export type OctopusVariant = "standard" | "compact";

export interface PixelSegment {
  char: string;
  color?: string;
  backgroundColor?: string;
  inverse?: boolean;
}

export interface RenderPixelGridOptions {
  monochrome?: boolean;
}

/**
 * 14x10 Micro 8-bit CoreBlow pixel octopus (renders as 5 seamless terminal half-block rows).
 * Uses vibrant coral fill + deep coral shading with rounded dome and flowing tentacles,
 * free of heavy dark outer borders so it stays crisp on both Light and Dark terminals.
 */
export const OCTOPUS_MICRO_GRID: readonly string[] = [
  "....BBBBBB....",
  "...BHHBBBBB...",
  "..BHBBBBBBBS..",
  "..BBBBBBBBBB..",
  "..BBWEBBWEBB..",
  "..BBEEBBEEBB..",
  "..BBBBBBBBSS..",
  ".BB.BBBBBB.BB.",
  "BB..BS..SB..BB",
  "B..B.B..B.B..B",
];

export const OCTOPUS_STANDARD_GRID: readonly string[] = OCTOPUS_MICRO_GRID;
export const OCTOPUS_COMPACT_GRID: readonly string[] = OCTOPUS_MICRO_GRID;

const WORDMARK_FONT: Record<string, readonly string[]> = {
  C: ["#####", "#    ", "#    ", "#    ", "#####"],
  O: ["#####", "#   #", "#   #", "#   #", "#####"],
  R: ["#### ", "#   #", "#### ", "#  # ", "#   #"],
  E: ["#####", "#    ", "#### ", "#    ", "#####"],
  B: ["#### ", "#   #", "#### ", "#   #", "#### "],
  L: ["#    ", "#    ", "#    ", "#    ", "#####"],
  W: ["#   #", "#   #", "# # #", "## ##", "#   #"],
};

const WORDMARK_TEXT = "COREBLOW";
const WORDMARK_ORANGE_START = 4; // "CORE" adaptive foreground, "BLOW" CoreBlow Orange

export function selectOctopusGrid(columns: number): {
  variant: OctopusVariant;
  grid: readonly string[];
  width: number;
} {
  if (columns >= 72) {
    return { variant: "standard", grid: OCTOPUS_STANDARD_GRID, width: 14 };
  }
  return { variant: "compact", grid: OCTOPUS_COMPACT_GRID, width: 14 };
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
  // Use backgroundColor fill (space) when top === bottom so terminal line-height
  // padding never produces horizontal white stripes between rows.
  if (top === bottom) {
    return { char: " ", backgroundColor: top! };
  }
  // Use lower half-block (▄) with top as backgroundColor so font top-leading
  // never bleeds the bottom color above the top pixel on macOS terminals.
  return { char: "▄", color: bottom!, backgroundColor: top! };
}

function hasSameSegmentStyle(a: PixelSegment, b: PixelSegment): boolean {
  return (
    a.color === b.color &&
    a.backgroundColor === b.backgroundColor &&
    Boolean(a.inverse) === Boolean(b.inverse)
  );
}

function appendMergedSegment(segments: PixelSegment[], nextSeg: PixelSegment): void {
  const prevSeg = segments.at(-1);
  if (prevSeg && hasSameSegmentStyle(prevSeg, nextSeg)) {
    prevSeg.char += nextSeg.char;
  } else {
    segments.push(nextSeg);
  }
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
      appendMergedSegment(mergedSegments, pairToSegment(top, bottom, monochrome));
    }

    rows.push(mergedSegments);
  }

  return rows;
}

/**
 * Renders the 5-row "COREBLOW" pixel block wordmark without horizontal line-height gaps.
 * "CORE" uses terminal-adaptive inverse cells (dark on Light terminals, light on Dark terminals);
 * "BLOW" uses solid CoreBlow Orange background cells.
 */
export function renderWordmarkRows(options: RenderPixelGridOptions = {}): PixelSegment[][] {
  const monochrome = options.monochrome ?? isMonochromeMode();
  const rows: PixelSegment[][] = [];

  for (let row = 0; row < 5; row += 1) {
    const mergedSegments: PixelSegment[] = [];

    for (let letterIndex = 0; letterIndex < WORDMARK_TEXT.length; letterIndex += 1) {
      if (letterIndex > 0) {
        appendMergedSegment(mergedSegments, { char: " " });
      }
      const ch = WORDMARK_TEXT[letterIndex]!;
      const glyphRow = WORDMARK_FONT[ch]?.[row] ?? "     ";
      const isOrange = letterIndex >= WORDMARK_ORANGE_START;

      for (let col = 0; col < glyphRow.length; col += 1) {
        const filled = glyphRow[col] === "#";
        if (!filled) {
          appendMergedSegment(mergedSegments, { char: " " });
        } else if (monochrome) {
          appendMergedSegment(mergedSegments, { char: "█" });
        } else if (isOrange) {
          appendMergedSegment(mergedSegments, { char: " ", backgroundColor: WORDMARK_ORANGE });
        } else {
          appendMergedSegment(mergedSegments, { char: " ", inverse: true });
        }
      }
    }

    rows.push(mergedSegments);
  }

  return rows;
}
