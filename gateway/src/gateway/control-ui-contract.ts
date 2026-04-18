/** CoreBlow — Control UI Contract */ export interface ControlUiEndpoint { method: "GET" | "POST" | "PUT" | "DELETE"; path: string; description: string; }
