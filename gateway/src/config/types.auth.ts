/** CoreBlow — Types: Auth */ export interface AuthConfig { type: "none" | "token" | "oauth"; token?: string; users?: Array<{ id: string; name: string; role: "admin" | "user" }>; }
