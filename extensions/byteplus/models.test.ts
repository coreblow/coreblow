/**
 * extensions/byteplus/models.test.ts
 *
 * CoreBlow — BytePlus Extension Models Tests
 * Verifies BytePlus base URL constants and default model IDs.
 */
import { describe, expect, it } from "vitest";
import {
  BYTEPLUS_BASE_URL,
  BYTEPLUS_CODING_BASE_URL,
  BYTEPLUS_CODING_DEFAULT_MODEL_ID,
  BYTEPLUS_DEFAULT_MODEL_ID,
} from "./models.js";

describe("BytePlus model constants", () => {
  it("BYTEPLUS_BASE_URL is a valid HTTPS URL", () => {
    expect(BYTEPLUS_BASE_URL.startsWith("https://")).toBe(true);
  });

  it("BYTEPLUS_BASE_URL contains bytepluses.com", () => {
    expect(BYTEPLUS_BASE_URL).toContain("bytepluses.com");
  });

  it("BYTEPLUS_CODING_BASE_URL is a valid HTTPS URL", () => {
    expect(BYTEPLUS_CODING_BASE_URL.startsWith("https://")).toBe(true);
  });

  it("BYTEPLUS_DEFAULT_MODEL_ID is a non-empty string", () => {
    expect(typeof BYTEPLUS_DEFAULT_MODEL_ID).toBe("string");
    expect(BYTEPLUS_DEFAULT_MODEL_ID.length).toBeGreaterThan(0);
  });

  it("BYTEPLUS_CODING_DEFAULT_MODEL_ID is a non-empty string", () => {
    expect(typeof BYTEPLUS_CODING_DEFAULT_MODEL_ID).toBe("string");
    expect(BYTEPLUS_CODING_DEFAULT_MODEL_ID.length).toBeGreaterThan(0);
  });

  it("default and coding model IDs are distinct", () => {
    expect(BYTEPLUS_DEFAULT_MODEL_ID).not.toBe(BYTEPLUS_CODING_DEFAULT_MODEL_ID);
  });
});
