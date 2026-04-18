/** CoreBlow — Sandbox Docker Types */ export interface DockerSandboxConfig { image: string; tag: string; volumes: string[]; env: Record<string, string>; }
