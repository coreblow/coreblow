export function pauseSubAgent(id: string) { return { paused: true, id }; }
export function cancelSubAgent(id: string) { return { cancelled: true, id }; }
export function cancelAllSubAgents() { return { cancelled: 0 }; }
export function killSubagentRunAdmin(id: string) { return true; }
export function killSubagentsByLabel(label: string) { return 0; }
export function killSubagentsByAge(maxAgeMs: number) { return 0; }
