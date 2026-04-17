/**
 * CoreBlow — API Versioning
 *
 * Manages API version routing, deprecation notices,
 * version negotiation, and backward compatibility.
 */

/** API version */
export interface ApiVersion {
    version: string;
    status: 'current' | 'supported' | 'deprecated' | 'removed';
    releaseDate: number;
    sunsetDate?: number;
    description?: string;
    routes: Map<string, ApiRoute>;
}

/** API route */
export interface ApiRoute {
    path: string;
    method: string;
    handler: string;
    deprecated?: boolean;
    replacedBy?: string;
}

/** Version negotiation result */
export interface VersionResult {
    version: string;
    status: string;
    warnings: string[];
}

/**
 * CoreBlow API Versioning
 */
export class ApiVersioning {
    private versions = new Map<string, ApiVersion>();
    private defaultVersion = 'v1';

    constructor() {
        // Register v1
        this.registerVersion({
            version: 'v1', status: 'current',
            releaseDate: Date.now(), description: 'CoreBlow API v1',
            routes: new Map([
                ['/chat', { path: '/chat', method: 'POST', handler: 'chat' }],
                ['/models', { path: '/models', method: 'GET', handler: 'listModels' }],
                ['/health', { path: '/health', method: 'GET', handler: 'health' }],
                ['/config', { path: '/config', method: 'GET', handler: 'getConfig' }],
                ['/agents', { path: '/agents', method: 'GET', handler: 'listAgents' }],
            ]),
        });
    }

    /**
     * Register an API version.
     */
    registerVersion(version: ApiVersion): void {
        this.versions.set(version.version, version);
    }

    /**
     * Negotiate version from request.
     */
    negotiate(requestedVersion?: string): VersionResult {
        const warnings: string[] = [];
        const version = requestedVersion ?? this.defaultVersion;

        const apiVersion = this.versions.get(version);
        if (!apiVersion) {
            return { version: this.defaultVersion, status: 'current', warnings: [`Unknown version "${version}", using ${this.defaultVersion}`] };
        }

        if (apiVersion.status === 'deprecated') {
            warnings.push(`API ${version} is deprecated${apiVersion.sunsetDate ? `. Sunset: ${new Date(apiVersion.sunsetDate).toISOString()}` : ''}.`);
        }

        if (apiVersion.status === 'removed') {
            return { version: this.defaultVersion, status: 'current', warnings: [`API ${version} has been removed, using ${this.defaultVersion}`] };
        }

        return { version, status: apiVersion.status, warnings };
    }

    /**
     * Get routes for a version.
     */
    getRoutes(version: string): ApiRoute[] {
        const v = this.versions.get(version);
        return v ? Array.from(v.routes.values()) : [];
    }

    /**
     * Resolve a route for a version.
     */
    resolveRoute(version: string, path: string): ApiRoute | null {
        const v = this.versions.get(version);
        return v?.routes.get(path) ?? null;
    }

    /**
     * Deprecate a version.
     */
    deprecate(version: string, sunsetDate?: number): boolean {
        const v = this.versions.get(version);
        if (!v) return false;
        v.status = 'deprecated';
        v.sunsetDate = sunsetDate;
        return true;
    }

    /**
     * List all versions.
     */
    list(): Array<{ version: string; status: string; routeCount: number }> {
        return Array.from(this.versions.values()).map((v) => ({
            version: v.version, status: v.status, routeCount: v.routes.size,
        }));
    }

    /**
     * Set default version.
     */
    setDefault(version: string): boolean {
        if (!this.versions.has(version)) return false;
        this.defaultVersion = version;
        return true;
    }

    /** Count */
    count(): number { return this.versions.size; }
}
