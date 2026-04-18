/** CoreBlow — Program Helpers */ export function exitWithError(message: string, code = 1): never { console.error("Error: " + message); process.exit(code); }
