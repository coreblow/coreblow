/** CoreBlow — Provider Usage Fetch Shared */ export function normalizeProviderName(name: string): string { return name.toLowerCase().replace(/[^a-z0-9]/g, "-"); }
