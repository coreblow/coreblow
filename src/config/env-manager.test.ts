import { describe, expect, it } from "vitest";
import { EnvManager } from "./env-manager.js";

describe("EnvManager", () => {
  it("loads and retrieves a string env var", () => {
    const mgr = new EnvManager();
    mgr.define("API_URL", "string");
    mgr.load({ API_URL: "https://api.coreblow.com" });
    expect(mgr.get("API_URL")).toBe("https://api.coreblow.com");
  });

  it("coerces number env var", () => {
    const mgr = new EnvManager();
    mgr.define("PORT", "number");
    mgr.load({ PORT: "8080" });
    expect(mgr.get("PORT")).toBe(8080);
  });

  it("coerces boolean env var from 'true'", () => {
    const mgr = new EnvManager();
    mgr.define("DEBUG", "boolean");
    mgr.load({ DEBUG: "true" });
    expect(mgr.get("DEBUG")).toBe(true);
  });

  it("coerces boolean env var from '1'", () => {
    const mgr = new EnvManager();
    mgr.define("DEBUG", "boolean");
    mgr.load({ DEBUG: "1" });
    expect(mgr.get("DEBUG")).toBe(true);
  });

  it("coerces boolean env var from 'false'", () => {
    const mgr = new EnvManager();
    mgr.define("DEBUG", "boolean");
    mgr.load({ DEBUG: "false" });
    expect(mgr.get("DEBUG")).toBe(false);
  });

  it("uses default value when env var not set", () => {
    const mgr = new EnvManager();
    mgr.define("TIMEOUT", "number", false, 3000);
    mgr.load({});
    expect(mgr.get("TIMEOUT")).toBe(3000);
  });

  it("reports error for missing required var", () => {
    const mgr = new EnvManager();
    mgr.define("SECRET_KEY", "string", true);
    const { valid, errors } = mgr.load({});
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes("SECRET_KEY"))).toBe(true);
  });

  it("reports error for invalid number value", () => {
    const mgr = new EnvManager();
    mgr.define("WORKERS", "number");
    const { errors } = mgr.load({ WORKERS: "not-a-number" });
    expect(errors.some((e) => e.includes("WORKERS"))).toBe(true);
  });

  it("returns valid=true when all required vars are present", () => {
    const mgr = new EnvManager();
    mgr.define("KEY", "string", true);
    const { valid } = mgr.load({ KEY: "abc" });
    expect(valid).toBe(true);
  });

  it("returns undefined for unknown key", () => {
    const mgr = new EnvManager();
    expect(mgr.get("UNKNOWN")).toBeUndefined();
  });
});
