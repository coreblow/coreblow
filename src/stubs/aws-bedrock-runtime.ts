// Stub for @aws-sdk/client-bedrock-runtime — prevents ERR_MODULE_NOT_FOUND in vitest
export class BedrockRuntimeClient { constructor(_config: any) {} send(_cmd: any) { return Promise.resolve({}); } }
export class InvokeModelCommand { constructor(_input: any) {} }
export class ConverseCommand { constructor(_input: any) {} }
export class ConverseStreamCommand { constructor(_input: any) {} }
