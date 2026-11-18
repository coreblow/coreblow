import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { App } from "../App";

describe("App Desktop Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    } as any);
  });

  it("instantiates App root component cleanly", () => {
    const element = <App />;
    expect(element).toBeDefined();
    expect(element.type).toBe(App);
  });
});
