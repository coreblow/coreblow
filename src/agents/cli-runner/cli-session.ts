/** CoreBlow — CLI Session */ export interface CliSession { id: string; startedAt: number; messages: Array<{ role: string; content: string }>; }
