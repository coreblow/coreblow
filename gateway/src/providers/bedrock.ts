/**
 * src/providers/bedrock.ts
 * AWS Bedrock AI provider — Claude, Llama, Titan via AWS SDK
 */

import type { AIProvider, ChatMessage, ChatOptions, ChatResponse } from './interface.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('provider:bedrock');

export class BedrockProvider implements AIProvider {
    name = 'bedrock';
    private region: string;
    private modelId: string;
    private accessKeyId?: string;
    private secretAccessKey?: string;

    constructor(config?: {
        region?: string;
        modelId?: string;
        accessKeyId?: string;
        secretAccessKey?: string;
    }) {
        this.region = config?.region || process.env.AWS_REGION || 'us-east-1';
        this.modelId = config?.modelId || 'anthropic.claude-3-haiku-20240307-v1:0';
        this.accessKeyId = config?.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
        this.secretAccessKey = config?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;
    }

    async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
        try {
            const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');

            const client = new BedrockRuntimeClient({
                region: this.region,
                ...(this.accessKeyId && this.secretAccessKey ? {
                    credentials: {
                        accessKeyId: this.accessKeyId,
                        secretAccessKey: this.secretAccessKey,
                    },
                } : {}),
            });

            // Convert to Bedrock format (Claude-style for Anthropic models)
            const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
            const nonSystem = messages.filter(m => m.role !== 'system');

            const payload: Record<string, any> = {
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: options?.maxTokens || 4096,
                system: system || 'You are a helpful AI assistant.',
                messages: nonSystem.map(m => ({
                    role: m.role === 'assistant' ? 'assistant' : 'user',
                    content: m.content,
                })),
            };

            if (options?.temperature !== undefined) payload.temperature = options.temperature;

            const command = new InvokeModelCommand({
                modelId: this.modelId,
                contentType: 'application/json',
                accept: 'application/json',
                body: JSON.stringify(payload),
            });

            const response = await client.send(command);
            const result = JSON.parse(new TextDecoder().decode(response.body));

            return {
                text: result.content?.[0]?.text || '',
                usage: {
                    promptTokens: result.usage?.input_tokens || 0,
                    completionTokens: result.usage?.output_tokens || 0,
                },
                raw: result,
            };
        } catch (err: any) {
            log.error({ err: err.message }, 'Bedrock chat failed');
            throw err;
        }
    }

    async isAvailable(): Promise<boolean> {
        return !!(this.accessKeyId && this.secretAccessKey) || !!process.env.AWS_PROFILE;
    }

    listModels(): string[] {
        return [
            'anthropic.claude-3-haiku-20240307-v1:0',
            'anthropic.claude-3-sonnet-20240229-v1:0',
            'anthropic.claude-3-5-sonnet-20240620-v1:0',
            'amazon.titan-text-express-v1',
            'meta.llama3-1-70b-instruct-v1:0',
        ];
    }
}
