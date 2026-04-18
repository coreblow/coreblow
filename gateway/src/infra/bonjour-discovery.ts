/**
 * CoreBlow — Bonjour Discovery (full)
 */
import { BonjourDiscovery, type BonjourService } from './bonjour.js';

export interface DiscoveryOptions { type?: string; timeout?: number; }
let defaultDiscovery: BonjourDiscovery | null = null;
export function getDefaultDiscovery(): BonjourDiscovery { if (!defaultDiscovery) defaultDiscovery = new BonjourDiscovery(); return defaultDiscovery; }
export function discoverServices(opts?: DiscoveryOptions): BonjourService[] { return getDefaultDiscovery().find(opts?.type ?? '_coreblow._tcp'); }
export function registerService(svc: BonjourService): void { getDefaultDiscovery().register(svc); }
export function resetDiscovery(): void { defaultDiscovery = null; }
