/** CoreBlow — Setup Registry */ const setups = new Map<string, Function>(); export function registerSetupWizard(type: string, wizard: Function): void { setups.set(type, wizard); }
