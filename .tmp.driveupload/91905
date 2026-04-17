/**
 * CoreBlow — API Docs Generator
 *
 * Auto-generates CoreAPI 3.0 specification from registered routes
 * and serves a JSON/YAML spec endpoint plus a Swagger UI redirect.
 */

/** Route documentation */
export interface RouteDoc {
    path: string;
    method: string;
    summary: string;
    description?: string;
    tags?: string[];
    parameters?: Array<{
        name: string;
        in: 'query' | 'path' | 'header';
        required?: boolean;
        schema: { type: string };
        description?: string;
    }>;
    requestBody?: {
        required?: boolean;
        content: Record<string, { schema: Record<string, unknown> }>;
    };
    responses: Record<string, {
        description: string;
        content?: Record<string, { schema: Record<string, unknown> }>;
    }>;
    security?: Array<Record<string, string[]>>;
    deprecated?: boolean;
}

/** API info */
export interface ApiInfo {
    title: string;
    version: string;
    description?: string;
    contact?: { name?: string; url?: string; email?: string };
    license?: { name: string; url?: string };
}

/**
 * CoreBlow API Docs Generator
 */
export class ApiDocsGenerator {
    private routes: RouteDoc[] = [];
    private info: ApiInfo;
    private servers: Array<{ url: string; description?: string }> = [];
    private tags: Array<{ name: string; description?: string }> = [];

    constructor(info: ApiInfo) {
        this.info = info;
    }

    /**
     * Add a route documentation.
     */
    addRoute(doc: RouteDoc): void {
        this.routes.push(doc);
    }

    /**
     * Add a server.
     */
    addServer(url: string, description?: string): void {
        this.servers.push({ url, description });
    }

    /**
     * Add a tag.
     */
    addTag(name: string, description?: string): void {
        this.tags.push({ name, description });
    }

    /**
     * Generate CoreAPI 3.0 spec.
     */
    generate(): Record<string, unknown> {
        const paths: Record<string, Record<string, unknown>> = {};

        for (const route of this.routes) {
            if (!paths[route.path]) paths[route.path] = {};
            const method = route.method.toLowerCase();

            const operation: Record<string, unknown> = {
                summary: route.summary,
                description: route.description,
                tags: route.tags,
                responses: route.responses,
            };
            if (route.parameters) operation.parameters = route.parameters;
            if (route.requestBody) operation.requestBody = route.requestBody;
            if (route.security) operation.security = route.security;
            if (route.deprecated) operation.deprecated = true;

            paths[route.path]![method] = operation;
        }

        return {
            coreapi: '3.0.3',
            info: {
                title: this.info.title,
                version: this.info.version,
                description: this.info.description,
                contact: this.info.contact,
                license: this.info.license,
            },
            servers: this.servers.length > 0 ? this.servers : [{ url: 'http://localhost:3000' }],
            tags: this.tags,
            paths,
            components: {
                securitySchemes: {
                    bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
                    apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
                },
            },
        };
    }

    /**
     * Generate JSON string.
     */
    toJSON(): string {
        return JSON.stringify(this.generate(), null, 2);
    }

    /**
     * Get route count.
     */
    routeCount(): number {
        return this.routes.length;
    }
}
