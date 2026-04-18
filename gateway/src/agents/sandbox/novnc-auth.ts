/** CoreBlow — Sandbox NoVNC Auth */ export function generateVncPassword(): string { return crypto.randomUUID().slice(0, 8); }
