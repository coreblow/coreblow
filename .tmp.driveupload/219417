import { describe, expect, it } from "vitest";
import { parseMarkdownTable, formatMarkdownTable, tableToCSV, convertMarkdownTables } from "./tables.js";

describe("parseMarkdownTable", () => {
  it("parses a standard markdown table", () => {
    const md = `
| Name | Age |
| ---- | --- |
| Alice | 30 |
| Bob | 25 |
`.trim();
    const table = parseMarkdownTable(md);
    expect(table).not.toBeNull();
    expect(table!.headers).toEqual(["Name", "Age"]);
    expect(table!.rows).toHaveLength(2);
    expect(table!.rows[0]).toEqual(["Alice", "30"]);
  });

  it("detects column alignment", () => {
    const md = `
| Left | Center | Right |
| :--- | :----: | ----: |
| a    | b      | c     |
`.trim();
    const table = parseMarkdownTable(md);
    expect(table!.alignments).toEqual(["left", "center", "right"]);
  });

  it("returns null for non-table input", () => {
    expect(parseMarkdownTable("just text")).toBeNull();
    expect(parseMarkdownTable("")).toBeNull();
  });

  it("handles single row table", () => {
    const md = `
| Header |
| ------ |
| Value  |
`.trim();
    const table = parseMarkdownTable(md);
    expect(table).not.toBeNull();
    expect(table!.rows).toHaveLength(1);
  });
});

describe("formatMarkdownTable", () => {
  it("formats a table back to markdown", () => {
    const table = {
      headers: ["A", "B"],
      rows: [["1", "2"], ["33", "44"]],
      alignments: [null, null] as Array<"left" | "center" | "right" | null>,
    };
    const result = formatMarkdownTable(table);
    expect(result).toContain("| A");
    expect(result).toContain("| 1");
    expect(result).toContain("---");
  });
});

describe("tableToCSV", () => {
  it("converts table to CSV format", () => {
    const table = {
      headers: ["Name", "Value"],
      rows: [["foo", "bar"], ["baz", "qux"]],
      alignments: [null, null] as Array<"left" | "center" | "right" | null>,
    };
    const csv = tableToCSV(table);
    expect(csv).toContain("Name,Value");
    expect(csv).toContain("foo,bar");
  });

  it("escapes commas in CSV", () => {
    const table = {
      headers: ["Name"],
      rows: [["hello, world"]],
      alignments: [null] as Array<"left" | "center" | "right" | null>,
    };
    const csv = tableToCSV(table);
    expect(csv).toContain('"hello, world"');
  });
});

describe("convertMarkdownTables", () => {
  it("returns input unchanged when mode is off", () => {
    expect(convertMarkdownTables("some text", "off")).toBe("some text");
  });

  it("returns input unchanged when no tables present", () => {
    const text = "Hello world\nNo tables here";
    expect(convertMarkdownTables(text, "bullets")).toBe(text);
  });

  it("handles empty string", () => {
    expect(convertMarkdownTables("", "bullets")).toBe("");
  });
});
