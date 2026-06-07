import { describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";
import { resolveGatewayReloadSettings } from "./config-reload-settings.js";

describe("resolveGatewayReloadSettings", () => {
  it("uses defaults when unset", () => {
    expect(resolveGatewayReloadSettings({})).toEqual({
      mode: "hybrid",
      debounceMs: 300,
    });
  });

  it("keeps supported reload mode and floors debounce", () => {
    expect(
      resolveGatewayReloadSettings({
        gateway: {
          reload: {
            mode: "hot",
            debounceMs: 42.8,
          },
        },
      } as CoreBlowConfig),
    ).toEqual({
      mode: "hot",
      debounceMs: 42,
    });
  });

  it("clamps negative debounce to zero", () => {
    expect(
      resolveGatewayReloadSettings({
        gateway: {
          reload: {
            mode: "restart",
            debounceMs: -10,
          },
        },
      } as CoreBlowConfig),
    ).toEqual({
      mode: "restart",
      debounceMs: 0,
    });
  });

  it("falls back when mode and debounce are invalid", () => {
    expect(
      resolveGatewayReloadSettings({
        gateway: {
          reload: {
            mode: "invalid",
            debounceMs: Number.NaN,
          },
        },
      } as unknown as CoreBlowConfig),
    ).toEqual({
      mode: "hybrid",
      debounceMs: 300,
    });
  });
});
