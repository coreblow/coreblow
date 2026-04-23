import { describe, it, expect } from "vitest";
import {
  sendHandlers,
} from "./send.js";

describe("send — export contract", () => {
  it("exports expected public API surface", () => {
    expect(sendHandlers).toBeDefined();
  });
});
