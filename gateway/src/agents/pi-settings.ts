/** PI agent settings. */
export interface PiSettings { theme?: 'dark' | 'light'; verbose?: boolean; autoApprove?: boolean; maxTurns?: number; }
export const DEFAULT_PI_SETTINGS: PiSettings = { theme: 'dark', verbose: false, autoApprove: false, maxTurns: 50 };
