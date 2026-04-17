/**
 * CoreBlow — CoreAPI Generator
 *
 * Generates CoreAPI 3.0 specification from registered
 * routes, schemas, and documentation metadata.
 */

/** CoreAPI path operation */
export interface PathOperation {
    method: string;
    path: string;
    summary: string;
    description?: string;
    tags?: string[];
    parameters?: Array<{ name: string; in: 'path' | 'query' | 'header'; required: boolean; schema: { type: string } }>;
    requestBody?: { contentType: string; schema: Record<string, unknown> };
    responses: Record<string, { description: string; schema?: Record<string, unknown> }>;
}

/** CoreAPI spec */
export interface CoreAPISpec {
    coreapi: string;
    info: { title: string; version: string; description?: string };
    servers: Array<{ url: string; description?: string }>;
    paths: Record<string, Record<string, unknown>>;
    components: { schemas: Record<string, unknown> };
}

/**
 * CoreBlow CoreAPI Generator
 */
export class CoreAPIGenerator {
    private operations: PathOperation[] = [];
    private schemas = new Map<string, Record<string, unknown>>();
    private info = { title: 'CoreBlow API', version: '1.0.0', description: '' };
    private servers: Array<{ url: string; description?: string }> = [];

    /**
     * Set API info.
     */
    setInfo(title: string, version: string, description?: string): void {
        this.info = { title, version, description: description ?? '' };
    }

    /**
     * Add server.
     */
    addServer(url: string, description?: string): void {
        this.servers.push({ url, description });
    }

    /**
     * Add an operation.
     */
    addOperation(op: PathOperation): void { this.operations.push(op); }

    /**
     * Add a schema.
     */
    addSchema(name: string, schema: Record<string, unknown>): void {
        this.schemas.set(name, schema);
    }

    /**
     * Generate CoreAPI spec.
     */
    generate(): CoreAPISpec {
        const paths: Record<string, Record<string, unknown>> = {};

        for (const op of this.operations) {
            if (!paths[op.path]) paths[op.path] = {};
            const method = op.method.toLowerCase();
            const operation: Record<string, unknown> = {
                summary: op.summary, description: op.description, tags: op.tags,
                responses: Object.fromEntries(
                    Object.entries(op.responses).map(([code, r]) => [code, {
                        description: r.description,
                        ...(r.schema ? { content: { 'application/json': { schema: r.schema } } } : {}),
                    }])
                ),
            };
            if (op.parameters) operation.parameters = op.parameters;
            if (op.requestBody) {
                operation.requestBody = { content: { [op.requestBody.contentType]: { schema: op.requestBody.schema } } };
            }
            paths[op.path]![method] = operation;
        }

        return {
            coreapi: '3.0.3', info: this.info,
            servers: this.servers.length > 0 ? this.servers : [{ url: 'http://localhost:3000' }],
            paths,
            components: { schemas: Object.fromEntries(this.schemas) },
        };
    }

    /**
     * Generate as JSON string.
     */
    toJSON(): string { return JSON.stringify(this.generate(), null, 2); }

    /** Count operations */
    count(): number { return this.operations.length; }
}
