export interface FleetSyncPlanItem {
  repo: string;
  relPath: string;
  fullPath: string;
  changed: boolean;
  next: string;
}

export interface FleetSyncOptions {
  version: string;
  sha256: string;
  sri: string;
  dryRun?: boolean;
  splitRoot?: string;
}

export declare function loadFleetManifest(): Record<string, unknown>;

export declare function parseSyncArgs(args: string[]): {
  version: string;
  sha256: string;
  sri: string;
  dryRun: boolean;
  splitRoot: string;
};

export declare function syncFleet(options: FleetSyncOptions): FleetSyncPlanItem[];
