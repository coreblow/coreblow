/**
 * agents/subagent-attachments.ts — File/data attachments for subagent communication.
 */
export interface SubagentAttachment { name: string; content: string; mimeType?: string; size: number; }
export function createAttachment(name: string, content: string, mimeType?: string): SubagentAttachment { return { name, content, mimeType: mimeType ?? 'text/plain', size: content.length }; }
export function serializeAttachments(attachments: SubagentAttachment[]): string { return JSON.stringify(attachments); }
export function deserializeAttachments(data: string): SubagentAttachment[] { try { return JSON.parse(data); } catch { return []; } }
export function totalAttachmentSize(attachments: SubagentAttachment[]): number { return attachments.reduce((sum, a) => sum + a.size, 0); }
