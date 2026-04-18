/** CoreBlow — Gateway CLI Shared */ export function getGatewayUrl(): string { return process.env.COREBLOW_GATEWAY_URL || "http://localhost:3000"; }
