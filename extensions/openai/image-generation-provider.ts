import type { ImageGenerationProvider } from "coreblow/plugin-sdk/image-generation";
import { resolveApiKeyForProvider } from "coreblow/plugin-sdk/provider-auth-runtime";
import { fetchWithTimeoutGuarded, postJsonRequest } from "coreblow/plugin-sdk/provider-http";
import { OPENAI_DEFAULT_IMAGE_MODEL as DEFAULT_OPENAI_IMAGE_MODEL } from "./default-models.js";

const DEFAULT_OPENAI_IMAGE_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OUTPUT_MIME = "image/png";
const DEFAULT_SIZE = "1024x1024";
const OPENAI_SUPPORTED_SIZES = ["1024x1024", "1024x1536", "1536x1024"] as const;

type OpenAIImageApiResponse = {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
  }>;
};

function resolveOpenAIBaseUrl(cfg: Parameters<typeof resolveApiKeyForProvider>[0]["cfg"]): string {
  const direct = cfg?.models?.providers?.openai?.baseUrl?.trim();
  return (direct || DEFAULT_OPENAI_IMAGE_BASE_URL).replace(/\/+$/, "");
}

function resolveOpenAIImageFileName(index: number, fileName?: string): string {
  return fileName?.trim() || `image-${index + 1}.png`;
}

function toOpenAIImageBlobPart(buffer: Buffer): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(buffer);
  return copy;
}

function appendOpenAIImageEditBody(
  form: FormData,
  req: Parameters<ImageGenerationProvider["generateImage"]>[0],
): void {
  form.set("model", req.model || DEFAULT_OPENAI_IMAGE_MODEL);
  form.set("prompt", req.prompt);
  form.set("n", String(req.count ?? 1));
  form.set("size", req.size ?? DEFAULT_SIZE);
  for (const [index, image] of (req.inputImages ?? []).entries()) {
    form.append(
      "image[]",
      new File([toOpenAIImageBlobPart(image.buffer)], resolveOpenAIImageFileName(index, image.fileName), {
        type: image.mimeType,
      }),
    );
  }
}

async function parseOpenAIImageResponse(response: Response): Promise<OpenAIImageApiResponse> {
  return (await response.json()) as OpenAIImageApiResponse;
}

function toOpenAIImageResult(data: OpenAIImageApiResponse) {
  return (data.data ?? [])
    .map((entry, index) => {
      if (!entry.b64_json) {
        return null;
      }
      return {
        buffer: Buffer.from(entry.b64_json, "base64"),
        mimeType: DEFAULT_OUTPUT_MIME,
        fileName: `image-${index + 1}.png`,
        ...(entry.revised_prompt ? { revisedPrompt: entry.revised_prompt } : {}),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

export function buildOpenAIImageGenerationProvider(): ImageGenerationProvider {
  return {
    id: "openai",
    label: "OpenAI",
    defaultModel: DEFAULT_OPENAI_IMAGE_MODEL,
    models: [DEFAULT_OPENAI_IMAGE_MODEL],
    capabilities: {
      generate: {
        maxCount: 4,
        supportsSize: true,
        supportsAspectRatio: false,
        supportsResolution: false,
      },
      edit: {
        enabled: true,
        maxCount: 4,
        maxInputImages: 16,
        supportsSize: true,
        supportsAspectRatio: false,
        supportsResolution: false,
      },
      geometry: {
        sizes: [...OPENAI_SUPPORTED_SIZES],
      },
    },
    async generateImage(req) {
      const auth = await resolveApiKeyForProvider({
        provider: "openai",
        cfg: req.cfg,
        agentDir: req.agentDir,
        store: req.authStore,
      });
      if (!auth.apiKey) {
        throw new Error("OpenAI API key missing");
      }

      const baseUrl = resolveOpenAIBaseUrl(req.cfg);
      const headers = new Headers({
        Authorization: `Bearer ${auth.apiKey}`,
      });
      const hasReferenceImages = (req.inputImages?.length ?? 0) > 0;
      const result = hasReferenceImages
        ? await fetchWithTimeoutGuarded(
            `${baseUrl}/images/edits`,
            {
              method: "POST",
              headers,
              body: (() => {
                const form = new FormData();
                appendOpenAIImageEditBody(form, req);
                return form;
              })(),
            },
            req.timeoutMs,
            fetch,
          )
        : await postJsonRequest({
            url: `${baseUrl}/images/generations`,
            headers: new Headers({
              Authorization: `Bearer ${auth.apiKey}`,
              "Content-Type": "application/json",
            }),
            body: {
              model: req.model || DEFAULT_OPENAI_IMAGE_MODEL,
              prompt: req.prompt,
              n: req.count ?? 1,
              size: req.size ?? DEFAULT_SIZE,
            },
            timeoutMs: req.timeoutMs,
            fetchFn: fetch,
          });

      const { response, release } = result;
      try {
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(
            `OpenAI image generation failed (${response.status}): ${text || response.statusText}`,
          );
        }

        const data = await parseOpenAIImageResponse(response);
        const images = toOpenAIImageResult(data);

        return {
          images,
          model: req.model || DEFAULT_OPENAI_IMAGE_MODEL,
        };
      } finally {
        await release();
      }
    },
  };
}
