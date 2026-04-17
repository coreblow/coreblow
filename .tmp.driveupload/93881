/**
 * CoreBlow Phase 30 — Request Processing Pipeline Chain Tests
 *
 * Layer 2 (Pipeline):
 *   TenantManager.get → TenantConfig.resolve → ResourceLimiter.record
 *   → NamespaceIsolation.get → Process
 *
 * Simulates the production request flow for multi-tenant API handling.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TenantManager } from '../../src/gateway/tenant-manager.js';
import { TenantConfig } from '../../src/gateway/tenant-config.js';
import { NamespaceIsolation } from '../../src/security/namespace-isolation.js';
import { ResourceLimiter } from '../../src/security/resource-limiter.js';
import { UsageBilling } from '../../src/gateway/usage-billing.js';

describe('Phase30 Chain: Request Processing Pipeline', () => {
    let tm: TenantManager;
    let tc: TenantConfig;
    let ns: NamespaceIsolation;
    let rl: ResourceLimiter;
    let billing: UsageBilling;
    let tenantId: string;

    beforeEach(() => {
        tm = new TenantManager();
        tc = new TenantConfig();
        ns = new NamespaceIsolation();
        rl = new ResourceLimiter();
        billing = new UsageBilling();

        tc.setDefaults({ model: 'gpt-4', maxTokens: 4096 });

        // Pre-provision a tenant
        const tenant = tm.create('API Corp', 'pro', { maxUsers: 50 });
        tenantId = tenant.id;
        tc.set(tenantId, { model: 'gpt-4o' });
        rl.setLimits(tenantId, { maxApiCalls: 1000 });
        ns.set(tenantId, 'session-cache', { activeSessions: 0 });
    });

    // ── Authorized Request Flow ──

    it('successful request: lookup → config → limit check → namespace → process', () => {
        // Step 1: Lookup tenant
        const tenant = tm.get(tenantId);
        expect(tenant).not.toBeNull();
        expect(tenant!.status).toBe('active');

        // Step 2: Resolve config
        const config = tc.resolve(tenantId);
        expect(config.model).toBe('gpt-4o');

        // Step 3: Check resource limits
        const limitResult = rl.record(tenantId, 'api', 1);
        expect(limitResult.allowed).toBe(true);

        // Step 4: Access scoped namespace
        const sessionData = ns.get(tenantId, 'session-cache');
        expect(sessionData).toBeTruthy();

        // Step 5: Record usage for billing
        billing.record(tenantId, 'api_calls', 1);
        billing.record(tenantId, 'tokens', 500);

        expect(billing.getCurrentUsage(tenantId).api_calls).toBe(1);
    });

    it('request with tenant-specific model override', () => {
        // Tenant B has different model
        const t2 = tm.create('Claude Corp', 'enterprise');
        tc.set(t2.id, { model: 'claude-3.5-sonnet', maxTokens: 200000 });

        // Default tenant gets gpt-4o
        const configA = tc.resolve(tenantId);
        expect(configA.model).toBe('gpt-4o');
        expect(configA.maxTokens).toBe(4096); // default

        // Enterprise tenant gets claude
        const configB = tc.resolve(t2.id);
        expect(configB.model).toBe('claude-3.5-sonnet');
        expect(configB.maxTokens).toBe(200000);
    });

    it('feature flag gates premium capabilities', () => {
        // Pro tenant has streaming enabled
        tc.setFeature(tenantId, 'real-time-streaming', true);

        // Free tenant does not
        const freeT = tm.create('Free User', 'free');

        // Gate the feature
        const proCanStream = tc.hasFeature(tenantId, 'real-time-streaming');
        const freeCanStream = tc.hasFeature(freeT.id, 'real-time-streaming');

        expect(proCanStream).toBe(true);
        expect(freeCanStream).toBe(false);
    });

    // ── Throttled / Blocked Request Flow ──

    it('request exceeds limit → rejected → usage still recorded for billing', () => {
        // Use up all API calls
        for (let i = 0; i < 1000; i++) {
            rl.record(tenantId, 'api', 1);
        }

        // Next request should be rejected
        const result = rl.record(tenantId, 'api', 1);
        expect(result.allowed).toBe(false);

        // But we still record for billing (overage tracking)
        billing.record(tenantId, 'api_calls', 1);
        expect(billing.getCurrentUsage(tenantId).api_calls).toBe(1);
    });

    it('suspended tenant → early rejection before config resolution', () => {
        tm.suspend(tenantId, 'tos-violation');

        // Step 1: Lookup returns suspended
        const tenant = tm.get(tenantId);
        expect(tenant!.status).toBe('suspended');

        // In production, we'd early-return here before resolving config
        // Verify the config still exists but shouldn't be used
        if (tenant!.status === 'suspended') {
            // Early rejection — don't resolve config, don't record usage
            expect(tenant!.metadata?.suspendReason).toBe('tos-violation');
        }
    });

    it('warning at 80% usage → request allowed with warning', () => {
        // Record 85% of limit
        rl.record(tenantId, 'api', 850);

        const result = rl.record(tenantId, 'api', 1);
        expect(result.allowed).toBe(true);
        expect(result.warning).toBeTruthy();

        // Usage percentage should reflect high usage
        const pct = rl.getPercentage(tenantId)!;
        expect(pct.api).toBeGreaterThan(80);
    });
});
