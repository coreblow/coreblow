/** CoreBlow — Context Pruner */ export function pruneOldMessages(messages: unknown[], keep: number): unknown[] { return messages.slice(-keep); }
