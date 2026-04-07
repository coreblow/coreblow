/**
 * my-tool-plugin — Tools
 */

export const exampleTool = {
    name: 'my-tool-plugin_search',
    description: 'Example tool for my-tool-plugin',
    parameters: {
        query: { type: 'string', description: 'Search query', required: true },
    },
    async execute(args: Record<string, unknown>) {
        const query = String(args.query ?? '');
        return `Results for: ${query}`;
    },
};
