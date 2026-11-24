export interface FleetToolConfig {
  name: string;
  alias?: string;
  binary: string;
  altBinary?: string;
  siblingDir: string;
  requiresDarwin?: boolean;
  installHint: string;
  resolveCommand: (
    resolution: FleetToolResolution,
    userArgs: string[]
  ) => { cmd: string; args: string[]; cwd?: string } | null;
}

export interface FleetToolResolution {
  status: "path" | "sibling" | "missing" | "unknown";
  config?: FleetToolConfig;
  onPath: string | null;
  siblingPath: string | null;
  expectedSiblingPath: string;
  installHint: string;
  toolKey?: string;
  error?: string;
}

export interface FleetExecOptions {
  splitRoot?: string;
  pathEnv?: string;
  env?: Record<string, string>;
}

export declare const FLEET_TOOL_CONFIGS: Record<string, FleetToolConfig>;

export declare function findBinaryOnPath(name: string, envPath?: string): string | null;

export declare function resolveFleetTool(
  toolKey: string,
  options?: FleetExecOptions
): FleetToolResolution;

export declare function listFleetTools(options?: FleetExecOptions): void;

export declare function executeFleetTool(
  toolKey: string,
  userArgs?: string[],
  options?: FleetExecOptions
): Promise<number>;
