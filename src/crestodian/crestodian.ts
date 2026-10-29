export type CrestodianFacade = Record<string, unknown>;

export type RunCrestodianOptions = {
  message?: string;
  yes?: boolean;
  json?: boolean;
  interactive?: boolean;
  onReady?: () => void;
  [key: string]: unknown;
};

export async function runCrestodian(_opts?: RunCrestodianOptions, _runtime?: unknown): Promise<void> {
  // Crestodian facade runner
}

export const crestodian = Object.freeze({
  id: "src/crestodian/crestodian.ts",
  runCrestodian,
});
