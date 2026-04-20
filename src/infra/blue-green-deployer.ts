/**
 * CoreBlow — Blue-Green Deployer
 *
 * Manages blue-green deployment strategy with traffic
 * switching, canary percentages, and instant rollback.
 */

/** Slot */
export interface DeploySlot {
    name: 'blue' | 'green';
    version: string;
    status: 'active' | 'standby' | 'deploying';
    deployedAt?: number;
    healthCheck?: () => Promise<boolean>;
}

/**
 * CoreBlow Blue-Green Deployer
 */
export class BlueGreenDeployer {
    private blue: DeploySlot = { name: 'blue', version: '', status: 'standby' };
    private green: DeploySlot = { name: 'green', version: '', status: 'standby' };
    private activeSlot: 'blue' | 'green' = 'blue';
    private canaryPercent = 0;
    private history: Array<{ from: string; to: string; version: string; timestamp: number }> = [];

    /**
     * Deploy to standby slot.
     */
    async deploy(version: string): Promise<{ success: boolean; slot: string }> {
        const standby = this.activeSlot === 'blue' ? this.green : this.blue;
        standby.version = version;
        standby.status = 'deploying';

        if (standby.healthCheck) {
            const healthy = await standby.healthCheck();
            if (!healthy) {
                standby.status = 'standby';
                return { success: false, slot: standby.name };
            }
        }

        standby.status = 'standby';
        standby.deployedAt = Date.now();
        return { success: true, slot: standby.name };
    }

    /**
     * Switch traffic to standby.
     */
    switchTraffic(): { success: boolean; activeSlot: string } {
        const old = this.activeSlot;
        const active = old === 'blue' ? this.blue : this.green;
        const standby = old === 'blue' ? this.green : this.blue;

        if (!standby.version) return { success: false, activeSlot: old };

        active.status = 'standby';
        standby.status = 'active';
        this.activeSlot = standby.name;
        this.canaryPercent = 0;

        this.history.push({ from: old, to: standby.name, version: standby.version, timestamp: Date.now() });
        return { success: true, activeSlot: standby.name };
    }

    /**
     * Set canary percentage.
     */
    setCanary(percent: number): void { this.canaryPercent = Math.max(0, Math.min(100, percent)); }

    /**
     * Route request (simulate).
     */
    routeRequest(): string {
        if (this.canaryPercent > 0 && Math.random() * 100 < this.canaryPercent) {
            return this.activeSlot === 'blue' ? 'green' : 'blue';
        }
        return this.activeSlot;
    }

    /**
     * Rollback to previous.
     */
    rollback(): boolean { return this.switchTraffic().success; }

    /**
     * Get status.
     */
    getStatus(): { activeSlot: string; blue: DeploySlot; green: DeploySlot; canaryPercent: number } {
        return { activeSlot: this.activeSlot, blue: { ...this.blue }, green: { ...this.green }, canaryPercent: this.canaryPercent };
    }

    /**
     * Set health check for slot.
     */
    setHealthCheck(slot: 'blue' | 'green', fn: () => Promise<boolean>): void {
        if (slot === 'blue') this.blue.healthCheck = fn;
        else this.green.healthCheck = fn;
    }

    /**
     * Get history.
     */
    getHistory(): typeof this.history { return [...this.history]; }
}

// ---------------------------------------------------------------------------
// BlueGreenDeployerService — Tier-1 Standalone Singleton
// ---------------------------------------------------------------------------

import { createTestingHooks } from "./service-patterns.js";

export class BlueGreenDeployerService {
  [Symbol.toStringTag] = 'BlueGreenDeployerService';
}

let _blueGreenDeployerInstance: BlueGreenDeployerService | null = null;

export function getBlueGreenDeployerService(): BlueGreenDeployerService {
  if (!_blueGreenDeployerInstance) {
    _blueGreenDeployerInstance = new BlueGreenDeployerService();
  }
  return _blueGreenDeployerInstance;
}

export const __testing_blueGreenDeployer = createTestingHooks<BlueGreenDeployerService>(
  () => { _blueGreenDeployerInstance = null; },
  (svc) => { _blueGreenDeployerInstance = svc; },
);
