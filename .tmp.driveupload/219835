/**
 * CoreBlow — Route Matcher
 *
 * Matches incoming requests to registered routes with
 * path parameters, wildcards, and method filtering.
 */

/** Route definition */
export interface RouteDefinition {
    method: string;
    path: string;
    handler: string;
    middleware?: string[];
    metadata?: Record<string, unknown>;
}

/** Match result */
export interface RouteMatch {
    route: RouteDefinition;
    params: Record<string, string>;
    query?: Record<string, string>;
}

/**
 * CoreBlow Route Matcher
 */
export class RouteMatcher {
    private routes: RouteDefinition[] = [];

    /**
     * Register a route.
     */
    add(method: string, path: string, handler: string, middleware?: string[]): void {
        this.routes.push({ method: method.toUpperCase(), path, handler, middleware });
    }

    /**
     * Convenience methods.
     */
    get(path: string, handler: string, mw?: string[]): void { this.add('GET', path, handler, mw); }
    post(path: string, handler: string, mw?: string[]): void { this.add('POST', path, handler, mw); }
    put(path: string, handler: string, mw?: string[]): void { this.add('PUT', path, handler, mw); }
    delete(path: string, handler: string, mw?: string[]): void { this.add('DELETE', path, handler, mw); }

    /**
     * Match a request.
     */
    match(method: string, path: string): RouteMatch | null {
        const upperMethod = method.toUpperCase();
        const [pathname, queryString] = path.split('?');
        const query = queryString ? this.parseQuery(queryString) : undefined;

        for (const route of this.routes) {
            if (route.method !== upperMethod && route.method !== '*') continue;
            const params = this.matchPath(route.path, pathname!);
            if (params !== null) return { route, params, query };
        }
        return null;
    }

    /**
     * List routes.
     */
    list(): Array<{ method: string; path: string; handler: string }> {
        return this.routes.map((r) => ({ method: r.method, path: r.path, handler: r.handler }));
    }

    /** Count */
    count(): number { return this.routes.length; }

    // === Private ===
    private matchPath(pattern: string, path: string): Record<string, string> | null {
        const patternParts = pattern.split('/');
        const pathParts = path.split('/');

        if (patternParts[patternParts.length - 1] === '*') {
            if (pathParts.length < patternParts.length - 1) return null;
        } else if (patternParts.length !== pathParts.length) return null;

        const params: Record<string, string> = {};
        for (let i = 0; i < patternParts.length; i++) {
            const pp = patternParts[i]!;
            if (pp === '*') return params;
            if (pp.startsWith(':')) { params[pp.slice(1)] = pathParts[i]!; continue; }
            if (pp !== pathParts[i]) return null;
        }
        return params;
    }

    private parseQuery(qs: string): Record<string, string> {
        const result: Record<string, string> = {};
        for (const pair of qs.split('&')) {
            const [key, val] = pair.split('=');
            if (key) result[key] = decodeURIComponent(val ?? '');
        }
        return result;
    }
}
