import { describe, expect, it } from "vitest";
import {
  buildOpenRouterImageGenerationProvider,
  buildOpenRouterImageRequestBody,
  extractOpenRouterGeneratedImages,
} from "./image-generation-provider.js";

describe("openrouter image generation provider", () => {
  it("advertises image generation and edit capabilities", () => {
    const provider = buildOpenRouterImageGenerationProvider();

    expect(provider.id).toBe("openrouter");
    expect(provider.defaultModel).toBe("google/gemini-3.1-flash-image-preview");
    expect(provider.models).toContain("openai/gpt-5.4-image-2");
    expect(provider.capabilities.generate.supportsAspectRatio).toBe(true);
    expect(provider.capabilities.edit.enabled).toBe(true);
  });

  it("builds OpenRouter chat-completions image payloads", () => {
    const body = buildOpenRouterImageRequestBody({
      model: "google/gemini-3.1-flash-image-preview",
      prompt: "draw a crisp icon",
      count: 99,
      aspectRatio: "16:9",
    });

    expect(body).toMatchObject({
      model: "google/gemini-3.1-flash-image-preview",
      modalities: ["image", "text"],
      n: 4,
      aspect_ratio: "16:9",
    });
  });

  it("extracts generated images from OpenRouter response shapes", () => {
    const png = Buffer.from("image-a").toString("base64");
    const jpeg = Buffer.from("image-b").toString("base64");
    const images = extractOpenRouterGeneratedImages({
      choices: [
        {
          message: {
            images: [{ image_url: { url: `data:image/png;base64,${png}` } }],
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${jpeg}` },
              },
            ],
          },
        },
      ],
    });

    expect(images).toHaveLength(2);
    expect(images[0]?.mimeType).toBe("image/png");
    expect(images[0]?.buffer.toString()).toBe("image-a");
    expect(images[1]?.mimeType).toBe("image/jpeg");
    expect(images[1]?.buffer.toString()).toBe("image-b");
  });
});
