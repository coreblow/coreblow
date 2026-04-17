/**
 * Type stub for @aws-sdk/client-bedrock-runtime
 * This is an optional dependency — only needed if using AWS Bedrock provider
 * Install: npm install @aws-sdk/client-bedrock-runtime
 */
declare module '@aws-sdk/client-bedrock-runtime' {
    export class BedrockRuntimeClient {
        constructor(config: {
            region: string;
            credentials?: {
                accessKeyId: string;
                secretAccessKey: string;
            };
        });
        send(command: InvokeModelCommand): Promise<{
            body: Uint8Array;
        }>;
    }

    export class InvokeModelCommand {
        constructor(input: {
            modelId: string;
            contentType: string;
            accept: string;
            body: string;
        });
    }
}
