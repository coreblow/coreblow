/** CoreBlow — Types: Sandbox */ export interface SandboxConfig { enabled: boolean; runtime: "docker" | "nsjail" | "none"; timeout: number; maxMemoryMb: number; networkAccess: boolean; }
