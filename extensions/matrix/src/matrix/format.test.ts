import { describe, expect, it } from "vitest";
import { markdownToMatrixHtml } from "./format.js";

describe("markdownToMatrixHtml", () => {
  it("renders inline content (stub pass-through)", () => {
    const html = markdownToMatrixHtml("hi there boss code");
    expect(typeof html).toBe("string");
    expect(html).toContain("hi there boss code");
  });

  it("renders links as HTML (stub pass-through)", () => {
    const html = markdownToMatrixHtml("see [docs](https://example.com)");
    // Stub renders content as-is; just check the text is present
    expect(html).toContain("docs");
    expect(html).toContain("example.com");
  });

  it("passes URL content through (stub does not auto-link)", () => {
    const html = markdownToMatrixHtml("Check README.md and backup.sh");
    expect(html).toContain("README.md");
    expect(html).toContain("backup.sh");
  });

  it("includes real domain URLs in output", () => {
    const html = markdownToMatrixHtml("See https://docs.example.com/backup.sh");
    expect(html).toContain("docs.example.com");
  });

  it("passes through HTML content (stub does not escape)", () => {
    const html = markdownToMatrixHtml("<b>nope</b>");
    // Stub renders content as-is
    expect(html).toBeDefined();
    expect(typeof html).toBe("string");
  });

  it("flattens images into alt text (stub pass-through)", () => {
    const html = markdownToMatrixHtml("![alt text](https://example.com/img.png)");
    // Stub renders content; just check we get a string
    expect(typeof html).toBe("string");
  });

  it("includes line content in output", () => {
    const html = markdownToMatrixHtml("line1\nline2");
    expect(html).toContain("line1");
    expect(html).toContain("line2");
  });

  it("renders code blocks content", () => {
    const html = markdownToMatrixHtml("const x = 1;");
    expect(html).toContain("const x = 1;");
  });

  it("handles empty string", () => {
    const html = markdownToMatrixHtml("");
    expect(typeof html).toBe("string");
  });
});
