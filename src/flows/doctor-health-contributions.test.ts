import { describe, expect, it } from "vitest";
import { resolveDoctorMode } from "./doctor-health-contributions.js";

describe("doctor health contributions", () => {
  it("resolves remote doctor mode from gateway config", () => {
    expect(resolveDoctorMode({ gateway: { mode: "remote" } })).toBe("remote");
    expect(resolveDoctorMode({ gateway: { mode: "local" } })).toBe("local");
  });
});
