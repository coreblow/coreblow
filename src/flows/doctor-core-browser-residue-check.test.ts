import { describe, expect, it } from "vitest";
import { scrubDoctorErrorMessage } from "./doctor-error-message.js";

describe("doctor core browser residue check", () => {
  it("scrubs control characters from doctor errors", () => {
    expect(scrubDoctorErrorMessage(new Error("bad\nbrowser\u0000state"))).toBe("badbrowserstate");
  });
});
