/** CoreBlow — Session Transcript Key */ export function buildTranscriptKey(sessionId: string, index: number): string { return sessionId + ":" + String(index).padStart(6, "0"); }
