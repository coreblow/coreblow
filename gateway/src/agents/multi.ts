/**
 * agents/multi.ts
 * Multi-agent router — dispatches requests to the appropriate agent based on routing rules.
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('agents:multi');

export interface AgentRoute {
    agentId: string;
    pattern?: RegExp;
    channels?: string[];
    priority?: number;
}

export class MultiAgentRouter {
    private routes: AgentRoute[] = [];
    private defaultAgentId = 'default';

    constructor(defaultAgentId?: string) {
        if (defaultAgentId) this.defaultAgentId = defaultAgentId;
    }

    addRoute(route: AgentRoute): void {
        this.routes.push(route);
        this.routes.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    }

    resolve(input: string, channel?: string): string {
        for (const route of this.routes) {
            if (route.channels && channel && !route.channels.includes(channel)) continue;
            if (route.pattern && !route.pattern.test(input)) continue;
            log.debug({ agentId: route.agentId, channel }, 'Route matched');
            return route.agentId;
        }
        return this.defaultAgentId;
    }

    listRoutes(): AgentRoute[] {
        return [...this.routes];
    }

    removeRoute(agentId: string): boolean {
        const idx = this.routes.findIndex(r => r.agentId === agentId);
        if (idx >= 0) { this.routes.splice(idx, 1); return true; }
        if (idx >= 0) { this.routes.splice(idx, 1); return true; }
        return false;
    }

    getStats() {
        return { routesEvaluated: 0, defaultHit: 0, totalAgents: 0 };
    }
}
