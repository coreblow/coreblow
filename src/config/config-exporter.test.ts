import { describe, beforeEach, expect, it } from "vitest";
import { ConfigExporter } from "./config-exporter.js";

let exporter: ConfigExporter;
const sample = { apiKey: "secret-123", debug: true, port: 3000, name: "CoreBlow" };

beforeEach(() => {
  exporter = new ConfigExporter();
});

describe("ConfigExporter — construction", () => {
  it("constructs without throwing", () => {
    expect(() => new ConfigExporter()).not.toThrow();
  });
});

describe("ConfigExporter.export() — json", () => {
  it("returns a string", () => {
    const result = exporter.export(sample, { format: "json" });
    expect(typeof result).toBe("string");
  });

  it("returns valid JSON", () => {
    const result = exporter.export(sample, { format: "json" });
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it("parsed JSON contains expected keys", () => {
    const result = exporter.export(sample, { format: "json" });
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.port).toBe(3000);
  });
});

describe("ConfigExporter.export() — env", () => {
  it("returns a string", () => {
    const result = exporter.export(sample, { format: "env" });
    expect(typeof result).toBe("string");
  });

  it("contains KEY=VALUE format", () => {
    const result = exporter.export(sample, { format: "env" });
    expect(result).toMatch(/\w+=.+/);
  });
});

describe("ConfigExporter.export() — yaml", () => {
  it("returns a non-empty string", () => {
    const result = exporter.export(sample, { format: "yaml" });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("ConfigExporter.export() — sections filter", () => {
  it("filters to specified sections when provided", () => {
    const nested = { gateway: { port: 8080 }, tools: { timeout: 30 } };
    const result = exporter.export(nested, { format: "json", sections: ["gateway"] });
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect("gateway" in parsed).toBe(true);
  });
});
