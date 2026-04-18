/** CoreBlow — Windows Task Restart */
export function buildWindowsTaskRestartCommand(taskName: string): string { return "schtasks /Run /TN " + JSON.stringify(taskName); }
