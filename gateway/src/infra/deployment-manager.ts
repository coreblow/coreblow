/**
 * CoreBlow — Deployment Manager
 *
 * Manages deployment lifecycle: create, deploy, verify,
 * promote, and track deployment history with versioning.
 */

/** Deployment */
export interface Deployment {
    id: string;
    version: string;
    environment: string;
    status: 'pending' | 'deploying' | 'deployed' | 'failed' | 'rolled_back';
    artifacts: string[];
    createdAt: number;
    deployedAt?: number;
    metadata?: Record<string, unknown>;
}

/**
 * CoreBlow Deployment Manager
 */
export class DeploymentManager {
    private deployments = new Map<string, Deployment>();
    private idCounter = 0;

    /**
     * Create a deployment.
     */
    create(version: string, environment: string, artifacts: string[]): Deployment {
        const id = `deploy-${++this.idCounter}`;
        const dep: Deployment = { id, version, environment, status: 'pending', artifacts, createdAt: Date.now() };
        this.deployments.set(id, dep);
        return dep;
    }

    /**
     * Start deploying.
     */
    deploy(id: string): boolean {
        const dep = this.deployments.get(id);
        if (!dep || dep.status !== 'pending') return false;
        dep.status = 'deploying';
        return true;
    }

    /**
     * Mark as deployed.
     */
    markDeployed(id: string): boolean {
        const dep = this.deployments.get(id);
        if (!dep || dep.status !== 'deploying') return false;
        dep.status = 'deployed';
        dep.deployedAt = Date.now();
        return true;
    }

    /**
     * Mark as failed.
     */
    markFailed(id: string): boolean {
        const dep = this.deployments.get(id);
        if (!dep) return false;
        dep.status = 'failed';
        return true;
    }

    /**
     * Get current deployment for environment.
     */
    getCurrent(environment: string): Deployment | null {
        const deployed = Array.from(this.deployments.values())
            .filter((d) => d.environment === environment && d.status === 'deployed')
            .sort((a, b) => (b.deployedAt ?? 0) - (a.deployedAt ?? 0));
        return deployed[0] ?? null;
    }

    /**
     * Get deployment history.
     */
    getHistory(environment?: string, limit?: number): Deployment[] {
        let deps = Array.from(this.deployments.values());
        if (environment) deps = deps.filter((d) => d.environment === environment);
        return deps.slice(-(limit ?? 20));
    }

    /**
     * Get a deployment.
     */
    get(id: string): Deployment | null { return this.deployments.get(id) ?? null; }

    /** Count */
    count(): number { return this.deployments.size; }
}
