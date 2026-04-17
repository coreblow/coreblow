/**
 * CoreBlow — OpenAI Image Generation Provider
 *
 * Supports: DALL-E 3, gpt-image-1
 * API: POST /v1/images/generations
 */

import type {
    ImageGenerationProvider, ImageGenerationCapabilities,
    ImageGenerationRequest, ImageGenerationResult,
} from '../types.js';

export class OpenAIImageProvider implements ImageGenerationProvider {
    readonly id = 'openai';
    readonly name = 'OpenAI (DALL-E / GPT Image)';
    readonly models = ['dall-e-3', 'dall-e-2', 'gpt-image-1'];
    readonly capabilities: ImageGenerationCapabilities = {
        generate: true,
        edit: true,
        sizes: ['256x256', '512x512', '1024x1024', '1024x1792', '1792x1024'],
        aspectRatios: ['1:1', '9:16', '16:9'],
        maxCount: 4,
        negativePrompt: false,
        styles: ['natural', 'vivid'],
        qualities: ['standard', 'hd'],
    };

    private apiKey: string | undefined;
    private baseUrl: string;

    constructor(opts?: { apiKey?: string; baseUrl?: string }) {
        this.apiKey = opts?.apiKey ?? process.env.OPENAI_API_KEY;
        this.baseUrl = opts?.baseUrl ?? 'https://api.openai.com';
    }

    isAvailable(): boolean {
        return !!this.apiKey;
    }

    async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
        if (!this.apiKey) throw new Error('OpenAI API key not configured');

        const model = request.model ?? 'dall-e-3';
        const size = request.size ?? '1024x1024';
        const n = Math.min(request.count ?? 1, model === 'dall-e-3' ? 1 : 4);
        const start = Date.now();

        const body: Record<string, unknown> = {
            model,
            prompt: request.prompt,
            n,
            size,
            response_format: 'b64_json',
        };

        if (request.quality && model === 'dall-e-3') body.quality = request.quality;
        if (request.style && model === 'dall-e-3') body.style = request.style;

        const res = await fetch(`${this.baseUrl}/v1/images/generations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(120000),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`OpenAI image generation failed (${res.status}): ${err}`);
        }

        const data = await res.json() as {
            data: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
        };

        const [w, h] = size.split('x').map(Number);

        return {
            images: data.data.map(img => ({
                base64: img.b64_json,
                url: img.url,
                revisedPrompt: img.revised_prompt,
                mimeType: 'image/png',
                width: w,
                height: h,
            })),
            provider: this.id,
            model,
            metadata: { durationMs: Date.now() - start },
        };
    }
}
