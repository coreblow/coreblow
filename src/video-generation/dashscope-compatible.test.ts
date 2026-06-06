import { describe, expect, it } from "vitest";
import {
  buildDashscopeVideoGenerationInput,
  buildDashscopeVideoGenerationParameters,
  extractDashscopeVideoUrls,
} from "./dashscope-compatible.js";

describe("dashscope compatible video generation helpers", () => {
  it("maps prompt and reference URLs into Dashscope input", () => {
    expect(
      buildDashscopeVideoGenerationInput({
        providerLabel: "Demo",
        req: {
          provider: "demo",
          model: "wan",
          prompt: "make video",
          cfg: {},
          inputImages: [{ url: "https://example.com/a.png" }],
        },
      }),
    ).toEqual({
      prompt: "make video",
      img_url: "https://example.com/a.png",
    });
  });

  it("rejects buffer-backed references", () => {
    expect(() =>
      buildDashscopeVideoGenerationInput({
        providerLabel: "Demo",
        req: {
          provider: "demo",
          model: "wan",
          prompt: "make video",
          cfg: {},
          inputImages: [{ buffer: Buffer.from("x") }],
        },
      }),
    ).toThrow("requires remote http(s) URLs");
  });

  it("maps common video parameters", () => {
    expect(
      buildDashscopeVideoGenerationParameters({
        provider: "demo",
        model: "wan",
        prompt: "make video",
        cfg: {},
        resolution: "720P",
        durationSeconds: 5.4,
        audio: true,
        watermark: false,
      }),
    ).toEqual({
      size: "1280*720",
      duration: 5,
      enable_audio: true,
      watermark: false,
    });
  });

  it("deduplicates output URLs", () => {
    expect(
      extractDashscopeVideoUrls({
        output: {
          results: [{ video_url: "https://example.com/a.mp4" }],
          video_url: "https://example.com/a.mp4",
        },
      }),
    ).toEqual(["https://example.com/a.mp4"]);
  });
});
