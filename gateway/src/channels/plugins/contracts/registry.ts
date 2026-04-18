/** CoreBlow — Contract Registry */ const contracts = new Map<string, unknown>(); export function registerContract(name: string, contract: unknown): void { contracts.set(name, contract); }
