import { describe, expect, it } from "vitest";
import {
  resolveNodeHostGatewayDeviceFamily,
  resolveNodeHostGatewayPlatform,
} from "./runner.js";

describe("runNodeHost", () => {
  it("maps runtime platforms to gateway platform ids", () => {
    expect(resolveNodeHostGatewayPlatform("darwin")).toBe("macos");
    expect(resolveNodeHostGatewayPlatform("win32")).toBe("windows");
    expect(resolveNodeHostGatewayPlatform("linux")).toBe("linux");
    expect(resolveNodeHostGatewayPlatform("freebsd")).toBe("unknown");
    expect(resolveNodeHostGatewayDeviceFamily("darwin")).toBe("Mac");
    expect(resolveNodeHostGatewayDeviceFamily("win32")).toBe("Windows");
    expect(resolveNodeHostGatewayDeviceFamily("linux")).toBe("Linux");
    expect(resolveNodeHostGatewayDeviceFamily("freebsd")).toBeUndefined();
  });
});
