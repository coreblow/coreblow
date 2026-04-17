/** PI project-level settings. */
export interface ProjectSettings { language?: string; framework?: string; testRunner?: string; packageManager?: string; }
export function detectProjectSettings(configFiles: string[]): ProjectSettings {
    const settings: ProjectSettings = {};
    if (configFiles.includes('tsconfig.json')) settings.language = 'typescript';
    if (configFiles.includes('next.config.js')) settings.framework = 'nextjs';
    if (configFiles.includes('vitest.config.ts')) settings.testRunner = 'vitest';
    return settings;
}
