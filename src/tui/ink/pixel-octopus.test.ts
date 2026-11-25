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
  it("renders Micro 8-bit 14x10 grid cleanly into 5 terminal rows", () => {
    expect(OCTOPUS_STANDARD_GRID).toHaveLength(10);
    for (const row of OCTOPUS_STANDARD_GRID) {
      expect(row).toHaveLength(14);
    }

    expect(OCTOPUS_COMPACT_GRID).toHaveLength(10);
    for (const row of OCTOPUS_COMPACT_GRID) {
      expect(row).toHaveLength(14);
    }

    const standardRows = renderPixelGridRows(OCTOPUS_STANDARD_GRID, { monochrome: false });
    expect(standardRows).toHaveLength(5);

    const compactRows = renderPixelGridRows(OCTOPUS_COMPACT_GRID, { monochrome: false });
    expect(compactRows).toHaveLength(5);
  });

  it("uses seamless backgroundColor fill for equal-color pairs and lower half-block for mixed pairs", () => {
    const syntheticGrid = [
      "..OBB.",
      "..BBO.",
    ];
    const [segments] = renderPixelGridRows(syntheticGrid, { monochrome: false });

    // Col 0-1: (. / .) -> merged two spaces with no color/backgroundColor
    expect(segments[0]).toEqual({ char: "  " });
    // Col 2: (O / B) -> lower half-block with bottom fg B and top bg O (avoids top-edge bleed)
    expect(segments[1]).toEqual({
      char: "▄",
      color: OCTOPUS_PALETTE.B,
      backgroundColor: OCTOPUS_PALETTE.O,
    });
    // Col 3: (B / B) -> seamless space with backgroundColor B (no horizontal stripes)
    expect(segments[2]).toEqual({
      char: " ",
      backgroundColor: OCTOPUS_PALETTE.B,
    });
    // Col 4: (B / O) -> lower half-block with bottom fg O and top bg B
    expect(segments[3]).toEqual({
      char: "▄",
      color: OCTOPUS_PALETTE.O,
      backgroundColor: OCTOPUS_PALETTE.B,
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

  it("never emits background colors on half-transparent edges", () => {
    for (const grid of [OCTOPUS_STANDARD_GRID, OCTOPUS_COMPACT_GRID]) {
      const rendered = renderPixelGridRows(grid, { monochrome: false });
      for (let r = 0; r < rendered.length; r += 1) {
        for (const seg of rendered[r]!) {
          if (seg.char.includes("▀")) {
            expect(seg.backgroundColor).toBeUndefined();
          }
          expect(seg.backgroundColor).not.toBe("#000000");
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
    expect(selectOctopusGrid(72)).toMatchObject({ variant: "standard", width: 14 });
    expect(selectOctopusGrid(71)).toMatchObject({ variant: "compact", width: 14 });
  });
});
