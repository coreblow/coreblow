/** CoreBlow — Update Progress */ export function printUpdateProgress(percent: number): void { process.stdout.write("\r  Updating: " + percent + "%"); }
