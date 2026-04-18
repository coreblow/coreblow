/** CoreBlow — Legacy Config Rules */
export interface LegacyRule { field: string; transform: (value: unknown) => unknown; }
export const LEGACY_RULES: LegacyRule[] = [
  { field: "apiKey", transform: (v) => ({ provider: { apiKey: v } }) },
  { field: "model", transform: (v) => ({ agent: { model: v } }) },
];
