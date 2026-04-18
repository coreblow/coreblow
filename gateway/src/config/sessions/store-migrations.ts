/** CoreBlow — Session Store Migrations */
export interface StoreMigration { version: number; name: string; migrate: (data: Record<string, unknown>) => Record<string, unknown>; }
export const STORE_MIGRATIONS: StoreMigration[] = [];
