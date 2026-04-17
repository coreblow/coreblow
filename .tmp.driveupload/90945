/** PI tool JSON schema definitions. */
export function buildToolSchema(name: string, description: string, properties: Record<string, unknown>): Record<string, unknown> {
    return { name, description, input_schema: { type: 'object', properties, required: Object.keys(properties) } };
}
