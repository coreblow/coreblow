/** CoreBlow — FS Bridge Mutation Helper */ export function isMutatingOperation(op: string): boolean { return ["write", "delete", "rename", "mkdir"].includes(op); }
