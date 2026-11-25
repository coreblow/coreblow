import { describe, expect, it } from "vitest";
import {
  isMonochromeMode,
  OCTOPUS_COMPACT_GRID,
  OCTOPUS_PALETTE,
  OCTOPUS_STANDARD_GRID,
  renderPixelGridRows,
  selectOctopusGrid,
} from "./pixel-octopus.js";

describe("pixel-octopus half-block renderer", () => {
  it("renders standard 16x16 grid into 8 terminal rows and compact 12x10 grid into 5 rows", () => {
    expect(OCTOPUS_STANDARD_GRID).toHaveLength(16);
    for (const row of OCTOPUS_STANDARD_GRID) {
      expect(row).toHaveLength(16);
    }

    expect(OCTOPUS_COMPACT_GRID).toHaveLength(10);
    for (const row of OCTOPUS_COMPACT_GRID) {
      expect(row).toHaveLength(12);
    }

    const standardRows = renderPixelGridRows(OCTOPUS_STANDARD_GRID, { monochrome: false });
    expect(standardRows).toHaveLength(8);

    const compactRows = renderPixelGridRows(OCTOPUS_COMPACT_GRID, { monochrome: false });
    expect(compactRows).toHaveLength(5);
  });

  it("never assigns backgroundColor to transparent pixel pairs and encodes all 5 pair rules", () => {
    const syntheticGrid = [
      "..OBB.",
      "..BBO.",
    ];
    const [segments] = renderPixelGridRows(syntheticGrid, { monochrome: false });

    // Col 0-1: (. / .) -> merged two spaces with no color/backgroundColor
    expect(segments[0]).toEqual({ char: "  " });
    // Col 2: (O / B) -> upper half-block with top fg O and bottom bg B
    expect(segments[1]).toEqual({
      char: "▀",
      color: OCTOPUS_PALETTE.O,
      backgroundColor: OCTOPUS_PALETTE.B,
    });
    // Col 3: (B / B) -> full block with fg B and no backgroundColor
    expect(segments[2]).toEqual({
      char: "█",
      color: OCTOPUS_PALETTE.B,
    });
    // Col 4: (B / O) -> upper half-block with top fg B and bottom bg O
    expect(segments[3]).toEqual({
      char: "▀",
      color: OCTOPUS_PALETTE.B,
      backgroundColor: OCTOPUS_PALETTE.O,
    });
    // Col 5: (. / .) -> space
    expect(segments[4]).toEqual({ char: " " });

    const singleHalfGrid = [
      "O.",
      ".B",
    ];
    const [halfSegments] = renderPixelGridRows(singleHalfGrid, { monochrome: false });
    expect(halfSegments[0]).toEqual({ char: "▀", color: OCTOPUS_PALETTE.O });
    expect(halfSegments[1]).toEqual({ char: "▄", color: OCTOPUS_PALETTE.B });
  });

  it("never emits background colors when either half of a standard/compact pair is transparent", () => {
    for (const grid of [OCTOPUS_STANDARD_GRID, OCTOPUS_COMPACT_GRID]) {
      const rendered = renderPixelGridRows(grid, { monochrome: false });
      for (let r = 0; r < rendered.length; r += 1) {
        for (const seg of rendered[r]!) {
          if (seg.char.includes(" ") || seg.char.includes("▄")) {
            expect(seg.backgroundColor).toBeUndefined();
          }
          expect(seg.backgroundColor).not.toBe("#000000");
          expect(seg.backgroundColor?.toLowerCase()).not.toBe("#ffffff");
        }
      }
    }
  });

  it("merges consecutive identical-style runs and supports NO_COLOR monochrome fallback", () => {
    const monochromeRows = renderPixelGridRows(["..OB..", "O.OB.B"], { monochrome: true });
    expect(monochromeRows).toHaveLength(1);
    const chars = monochromeRows[0]!.map((s) => s.char).join("");
    expect(chars).toContain("▄");
    expect(chars).toContain("█");
    for (const seg of monochromeRows[0]!) {
      expect(seg.color).toBeUndefined();
      expect(seg.backgroundColor).toBeUndefined();
    }

    const rowOnlyTop = renderPixelGridRows(["OO", ".."], { monochrome: true });
    expect(rowOnlyTop[0]).toEqual([{ char: "▀▀" }]);

    expect(isMonochromeMode({ NO_COLOR: "1" })).toBe(true);
    expect(isMonochromeMode({})).toBe(false);
  });

  it("switches between standard and compact octopus variants at 72 columns", () => {
    expect(selectOctopusGrid(72)).toMatchObject({ variant: "standard", width: 16 });
    expect(selectOctopusGrid(71)).toMatchObject({ variant: "compact", width: 12 });
  });
});
