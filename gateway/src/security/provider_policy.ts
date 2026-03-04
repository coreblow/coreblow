/**
 * src/security/provider_policy.ts
 * Per-provider tool policy — restrict which tools each provider can execute
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('provider-policy');

export interface ProviderToolPolicy {
    provider: string;
    mode: 'allow' | 'deny';   // allowlist or denylist mode
    tools: string[];           // tool names to allow/deny
    maxToolRounds?: number;    // max tool rounds per turn
    requireApproval?: string[]; // tools that need human approval
}

// Default policies — configurable via config.json
const DEFAULT_POLICIES: ProviderToolPolicy[] = [
    {
        provider: 'ollama',
        mode: 'allow',
        tools: ['*'],  // local = trusted, all tools allowed
        maxToolRounds: 10,
    },
    {
        provider: 'openai',
        mode: 'deny',
        tools: ['exec'],  // block exec for cloud providers by default
        maxToolRounds: 5,
        requireApproval: ['exec'],
    },
    {
        provider: 'anthropic',
        mode: 'deny',
        tools: ['exec'],
        maxToolRounds: 5,
        requireApproval: ['exec'],
    },
    {
        provider: 'openrouter',
        mode: 'deny',
        tools: ['exec', 'nodes'],  // more restrictive for 3rd party routers
        maxToolRounds: 3,
        requireApproval: ['exec', 'nodes'],
    },
];

export class ProviderPolicyManager {
    private policies: Map<string, ProviderToolPolicy> = new Map();

    constructor(customPolicies?: ProviderToolPolicy[]) {
        // Load defaults
        for (const p of DEFAULT_POLICIES) {
            this.policies.set(p.provider, p);
        }

        // Override with custom
        if (customPolicies) {
            for (const p of customPolicies) {
                this.policies.set(p.provider, p);
                log.debug({ provider: p.provider }, 'Custom tool policy loaded');
            }
        }
    }

    /**
     * Check if a tool is allowed for a provider
     */
    isToolAllowed(provider: string, toolName: string): boolean {
        const policy = this.policies.get(provider);
        if (!policy) return true;  // no policy = allow all

        if (policy.mode === 'allow') {
            return policy.tools.includes('*') || policy.tools.includes(toolName);
        } else {
            // deny mode
            return !policy.tools.includes(toolName);
        }
    }

    /**
     * Check if a tool requires human approval
     */
    requiresApproval(provider: string, toolName: string): boolean {
        const policy = this.policies.get(provider);
        if (!policy) return false;
        return policy.requireApproval?.includes(toolName) || false;
    }

    /**
     * Get max tool rounds for a provider
     */
    getMaxToolRounds(provider: string): number {
        const policy = this.policies.get(provider);
        return policy?.maxToolRounds || 5;
    }

    /**
     * Filter tool definitions based on provider policy
     */
    filterTools(provider: string, tools: Array<{ function: { name: string } }>): typeof tools {
        return tools.filter(t => this.isToolAllowed(provider, t.function.name));
    }

    /**
     * Get policy for a provider
     */
    getPolicy(provider: string): ProviderToolPolicy | undefined {
        return this.policies.get(provider);
    }

    /**
     * Set/update a policy
     */
    setPolicy(policy: ProviderToolPolicy) {
        this.policies.set(policy.provider, policy);
        log.info({ provider: policy.provider, mode: policy.mode }, 'Policy updated');
    }

    /**
     * List all policies
     */
    listPolicies(): ProviderToolPolicy[] {
        return Array.from(this.policies.values());
    }
}
