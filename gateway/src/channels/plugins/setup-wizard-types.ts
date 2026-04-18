/** CoreBlow — Setup Wizard Types */ export interface WizardStep { id: string; title: string; required: boolean; } export type WizardResult = { success: boolean; config?: Record<string, unknown> };
