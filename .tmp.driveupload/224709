/**
 * plugins/version-manager.ts
 *
 * Plugin version management — tracks installed versions,
 * checks compatibility with host and peer plugins,
 * manages update availability, and provides migration paths.
 *
 * Following CoreBlow's min-host-version.ts pattern.
 */

import { createChildLogger } from '../utils/logger.js';
import { parseSemver, compareSemver, satisfiesConstraint } from './dependency-graph.js';

const log = createChildLogger('plugin:version');

// ─── Types ───────────────────────────────────────────────────────

/** Version record for an installed plugin */
export interface PluginVersionRecord {
    pluginId: string;
    currentVersion: string;
    installedAt: number;
    updatedAt?: number;
    previousVersions?: string[];
}

/** Host compatibility check result */
export interface HostCompatResult {
    compatible: boolean;
    pluginId: string;
    requiredHostVersion: string;
    currentHostVersion: string;
    reason?: string;
}

/** Peer compatibility check result */
export interface PeerCompatResult {
    compatible: boolean;
    pluginId: string;
    peerId: string;
    requiredVersion: string;
    actualVersion?: string;
    reason?: string;
}

/** Update availability check */
export interface UpdateInfo {
    pluginId: string;
    currentVersion: string;
    latestVersion: string;
    updateAvailable: boolean;
    breaking: boolean;
}

/** Full compatibility report */
export interface CompatibilityReport {
    hostChecks: HostCompatResult[];
    peerChecks: PeerCompatResult[];
    allCompatible: boolean;
    warnings: string[];
    errors: string[];
}

// ─── VersionManager ──────────────────────────────────────────────

/**
 * CoreBlow Plugin Version Manager
 *
 * Tracks installed plugin versions, checks host/peer compatibility,
 * detects available updates, and provides migration guidance.
 */
export class VersionManager {
    private records = new Map<string, PluginVersionRecord>();
    private hostVersion: string;

    constructor(hostVersion: string = '1.0.0') {
        this.hostVersion = hostVersion;
    }

    // ─── Record Management ───────────────────────────────────────

    /**
     * Register a plugin version.
     */
    register(pluginId: string, version: string): void {
        const existing = this.records.get(pluginId);
        if (existing) {
            if (existing.currentVersion !== version) {
                existing.previousVersions = existing.previousVersions ?? [];
                existing.previousVersions.push(existing.currentVersion);
                existing.currentVersion = version;
                existing.updatedAt = Date.now();
            }
        } else {
            this.records.set(pluginId, {
                pluginId,
                currentVersion: version,
                installedAt: Date.now(),
            });
        }
    }

    /**
     * Unregister a plugin.
     */
    unregister(pluginId: string): boolean {
        return this.records.delete(pluginId);
    }

    /**
     * Get a version record.
     */
    getRecord(pluginId: string): PluginVersionRecord | undefined {
        return this.records.get(pluginId);
    }

    /**
     * Get the current version of a plugin.
     */
    getVersion(pluginId: string): string | undefined {
        return this.records.get(pluginId)?.currentVersion;
    }

    /**
     * Get all version records.
     */
    getAllRecords(): PluginVersionRecord[] {
        return Array.from(this.records.values());
    }

    // ─── Compatibility Checking ──────────────────────────────────

    /**
     * Check if a plugin is compatible with the current host version.
     */
    checkHostCompat(pluginId: string, minHostVersion: string): HostCompatResult {
        const compatible = satisfiesConstraint(this.hostVersion, `>=${minHostVersion}`);
        return {
            compatible,
            pluginId,
            requiredHostVersion: `>=${minHostVersion}`,
            currentHostVersion: this.hostVersion,
            reason: compatible
                ? undefined
                : `Plugin requires host >=${minHostVersion} but current host is ${this.hostVersion}`,
        };
    }

    /**
     * Check peer plugin compatibility.
     */
    checkPeerCompat(pluginId: string, peerId: string, requiredVersion: string): PeerCompatResult {
        const peerRecord = this.records.get(peerId);
        if (!peerRecord) {
            return {
                compatible: false,
                pluginId,
                peerId,
                requiredVersion,
                reason: `Peer plugin "${peerId}" is not installed`,
            };
        }

        const compatible = satisfiesConstraint(peerRecord.currentVersion, requiredVersion);
        return {
            compatible,
            pluginId,
            peerId,
            requiredVersion,
            actualVersion: peerRecord.currentVersion,
            reason: compatible
                ? undefined
                : `Peer "${peerId}" version ${peerRecord.currentVersion} does not satisfy ${requiredVersion}`,
        };
    }

    /**
     * Run a full compatibility check for a plugin.
     */
    checkCompatibility(params: {
        pluginId: string;
        minHostVersion?: string;
        peerDependencies?: Array<{ peerId: string; version: string }>;
    }): CompatibilityReport {
        const report: CompatibilityReport = {
            hostChecks: [],
            peerChecks: [],
            allCompatible: true,
            warnings: [],
            errors: [],
        };

        // Host check
        if (params.minHostVersion) {
            const hostResult = this.checkHostCompat(params.pluginId, params.minHostVersion);
            report.hostChecks.push(hostResult);
            if (!hostResult.compatible) {
                report.allCompatible = false;
                report.errors.push(hostResult.reason!);
            }
        }

        // Peer checks
        for (const peer of params.peerDependencies ?? []) {
            const peerResult = this.checkPeerCompat(params.pluginId, peer.peerId, peer.version);
            report.peerChecks.push(peerResult);
            if (!peerResult.compatible) {
                report.allCompatible = false;
                report.errors.push(peerResult.reason!);
            }
        }

        return report;
    }

    // ─── Update Detection ────────────────────────────────────────

    /**
     * Check if an update is available for a plugin.
     */
    checkUpdate(pluginId: string, latestVersion: string): UpdateInfo {
        const record = this.records.get(pluginId);
        const currentVersion = record?.currentVersion ?? '0.0.0';
        const current = parseSemver(currentVersion);
        const latest = parseSemver(latestVersion);

        const updateAvailable = current && latest ? compareSemver(latest, current) > 0 : false;
        const breaking = current && latest ? latest[0] > current[0] : false;

        return {
            pluginId,
            currentVersion,
            latestVersion,
            updateAvailable,
            breaking,
        };
    }

    /**
     * Check updates for all installed plugins.
     */
    checkAllUpdates(latestVersions: Record<string, string>): UpdateInfo[] {
        const results: UpdateInfo[] = [];
        for (const [pluginId, record] of this.records) {
            const latest = latestVersions[pluginId];
            if (latest) {
                results.push(this.checkUpdate(pluginId, latest));
            }
        }
        return results;
    }

    // ─── Migration ───────────────────────────────────────────────

    /**
     * Get the version upgrade path for a plugin.
     */
    getUpgradePath(pluginId: string): string[] {
        const record = this.records.get(pluginId);
        if (!record) return [];
        const previous = record.previousVersions ?? [];
        return [...previous, record.currentVersion];
    }

    /**
     * Check if a version downgrade would break dependents.
     */
    isDowngrade(pluginId: string, targetVersion: string): boolean {
        const current = this.getVersion(pluginId);
        if (!current) return false;
        const currentSemver = parseSemver(current);
        const targetSemver = parseSemver(targetVersion);
        if (!currentSemver || !targetSemver) return false;
        return compareSemver(targetSemver, currentSemver) < 0;
    }

    // ─── Info ────────────────────────────────────────────────────

    /** Get host version */
    getHostVersion(): string { return this.hostVersion; }

    /** Set host version */
    setHostVersion(version: string): void { this.hostVersion = version; }

    /** Count installed */
    count(): number { return this.records.size; }

    /** Clear all records */
    clear(): void { this.records.clear(); }
}
