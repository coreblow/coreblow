/**
 * src/tools/image.ts
 * Image analysis tool — uses vision model to describe images
 */

import type { ToolHandler } from './types.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('tool:image');

export const imageTool: ToolHandler = {
    name: 'image',
    description: 'Analyze an image using AI vision. Describe contents, extract text (OCR), identify objects, etc.',
    parameters: {
        type: 'object',
        properties: {
            url: { type: 'string', description: 'URL of the image to analyze' },
            prompt: { type: 'string', description: 'What to analyze (default: describe the image)' },
            model: { type: 'string', description: 'Vision model to use (optional)' },
        },
        required: ['url'],
    },

    async execute(args: Record<string, any>): Promise<string> {
        const { url, prompt = 'Describe this image in detail.', model } = args;

        // Try Ollama vision first
        try {
            const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
            const visionModel = model || 'llava';

            // Fetch image and convert to base64
            const imgRes = await fetch(url, { signal: AbortSignal.timeout(15000) });
            if (!imgRes.ok) return `Error fetching image: HTTP ${imgRes.status}`;

            const buffer = Buffer.from(await imgRes.arrayBuffer());
            const base64 = buffer.toString('base64');

            const res = await fetch(`${ollamaUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: visionModel,
                    messages: [{
                        role: 'user',
                        content: prompt,
                        images: [base64],
                    }],
                    stream: false,
                }),
                signal: AbortSignal.timeout(60000),
            });

            if (res.ok) {
                const data: any = await res.json();
                return data.message?.content || 'No description generated';
            }
        } catch (err: any) {
            log.debug({ err: err.message }, 'Ollama vision failed, trying OpenAI');
        }

        // Fallback: OpenAI Vision
        const openaiKey = process.env.OPENAI_API_KEY;
        if (openaiKey) {
            try {
                const res = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${openaiKey}`,
                    },
                    body: JSON.stringify({
                        model: model || 'gpt-4o-mini',
                        messages: [{
                            role: 'user',
                            content: [
                                { type: 'text', text: prompt },
                                { type: 'image_url', image_url: { url } },
                            ],
                        }],
                        max_tokens: 1000,
                    }),
                    signal: AbortSignal.timeout(30000),
                });

                if (res.ok) {
                    const data: any = await res.json();
                    return data.choices?.[0]?.message?.content || 'No description generated';
                }
            } catch (err: any) {
                return `Vision analysis failed: ${err.message}`;
            }
        }

        return 'Error: No vision model available. Install Ollama with llava, or set OPENAI_API_KEY.';
    },
};
