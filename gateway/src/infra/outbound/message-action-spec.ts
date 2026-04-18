/** CoreBlow — Message Action Spec */
export interface ActionSpec { type: string; label: string; style?: "primary" | "secondary" | "danger"; confirm?: boolean; }
export function createActionSpec(type: string, label: string): ActionSpec { return { type, label }; }
