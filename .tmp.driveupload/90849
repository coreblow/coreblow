/** Adapt tool definitions between formats. */
export function anthropicToOpenAI(tool: { name: string; description: string; input_schema: unknown }): { type: string; function: { name: string; description: string; parameters: unknown } } {
    return { type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.input_schema } };
}
