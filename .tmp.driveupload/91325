/** Anthropic Vertex AI stream adapter. */
export interface VertexStreamConfig { projectId: string; location: string; model: string; }
export function buildVertexEndpoint(config: VertexStreamConfig): string { return `https://${config.location}-aiplatform.googleapis.com/v1/projects/${config.projectId}/locations/${config.location}/publishers/anthropic/models/${config.model}:streamRawPredict`; }
