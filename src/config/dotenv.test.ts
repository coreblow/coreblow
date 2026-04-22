import { describe, expect, it } from "vitest";
import { parseDotenv } from "./dotenv.js";

describe("parseDotenv", () => {
  it("parses simple KEY=VALUE pairs", () => {
    const result = parseDotenv("FOO=bar\nBAZ=qux");
    expect(result.FOO).toBe("bar");
    expect(result.BAZ).toBe("qux");
  });

  it("strips double-quoted values", () => {
    const result = parseDotenv('KEY="hello world"');
    expect(result.KEY).toBe("hello world");
  });

  it("strips single-quoted values", () => {
    const result = parseDotenv("KEY='hello world'");
    expect(result.KEY).toBe("hello world");
  });

  it("ignores comment lines starting with #", () => {
    const result = parseDotenv("# this is a comment\nFOO=bar");
    expect(Object.keys(result)).not.toContain("#");
    expect(result.FOO).toBe("bar");
  });

  it("ignores blank lines", () => {
    const result = parseDotenv("\n\nFOO=bar\n\n");
    expect(result.FOO).toBe("bar");
    expect(Object.keys(result).length).toBe(1);
  });

  it("ignores lines without = sign", () => {
    const result = parseDotenv("INVALID_LINE\nFOO=bar");
    expect(Object.keys(result)).not.toContain("INVALID_LINE");
    expect(result.FOO).toBe("bar");
  });

  it("returns empty object for empty string", () => {
    expect(parseDotenv("")).toEqual({});
  });

  it("handles value with = sign in it", () => {
    const result = parseDotenv("TOKEN=abc=def=ghi");
    expect(result.TOKEN).toBe("abc=def=ghi");
  });

  it("trims whitespace around key", () => {
    const result = parseDotenv("  KEY  =value");
    expect(result.KEY).toBe("value");
  });

  it("handles empty value", () => {
    const result = parseDotenv("EMPTY=");
    expect(result.EMPTY).toBe("");
  });
});
