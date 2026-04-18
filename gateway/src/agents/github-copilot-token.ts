/** CoreBlow — GitHub Copilot Token */ export function resolveGitHubCopilotToken(): string | null { return process.env.GITHUB_COPILOT_TOKEN?.trim() ?? null; }
