import { describe, expect, it } from "vitest";
import { parseSystemctlShowProperties } from "./wsl2-crash-loop-check.js";

describe("ollama wsl2 crash loop check", () => {
  it("parses systemctl show properties", () => {
    const props = parseSystemctlShowProperties("UnitFileState=enabled\nRestart=always\n");
    expect(props.get("UnitFileState")).toBe("enabled");
    expect(props.get("Restart")).toBe("always");
  });
});
