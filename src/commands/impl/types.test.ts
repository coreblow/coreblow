import { describe, it, expect } from "vitest";
import { parseFlags } from "./types.js";

describe("parseFlags", () => {
  it("separates positional args from flags", () => {
    const result = parseFlags(["arg1", "--verbose", "arg2"]);
    expect(result.positional).toEqual(["arg1", "arg2"]);
    expect(result.flags.verbose).toBe(true);
  });

  it("parses --key=value flags", () => {
    const result = parseFlags(["--name=Alice", "--count=3"]);
    expect(result.flags.name).toBe("Alice");
    expect(result.flags.count).toBe("3");
    expect(result.positional).toEqual([]);
  });

  it("handles --key=value with = in value", () => {
    const result = parseFlags(["--env=FOO=BAR"]);
    expect(result.flags.env).toBe("FOO=BAR");
  });

  it("parses boolean --flag without value", () => {
    const result = parseFlags(["--force", "--dry-run"]);
    expect(result.flags.force).toBe(true);
    expect(result.flags["dry-run"]).toBe(true);
  });

  it("parses short -f flags", () => {
    const result = parseFlags(["-v", "-f"]);
    expect(result.flags.v).toBe(true);
    expect(result.flags.f).toBe(true);
  });

  it("ignores short flags longer than 2 chars (not treated as flags)", () => {
    const result = parseFlags(["-abc"]);
    expect(result.positional).toEqual(["-abc"]);
    expect(result.flags.abc).toBeUndefined();
  });

  it("handles empty args", () => {
    const result = parseFlags([]);
    expect(result.positional).toEqual([]);
    expect(result.flags).toEqual({});
  });

  it("handles mixed args", () => {
    const result = parseFlags(["deploy", "--force", "production", "-v", "--env=staging"]);
    expect(result.positional).toEqual(["deploy", "production"]);
    expect(result.flags.force).toBe(true);
    expect(result.flags.v).toBe(true);
    expect(result.flags.env).toBe("staging");
  });
});
