import { describe, it, expect } from "vitest";
import {
  startGatewayMaintenanceTimers,
} from "./server-maintenance.js";

describe("server-maintenance — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof startGatewayMaintenanceTimers).toBe("function");
  });
});
