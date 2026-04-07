/** GitHub Copilot token resolution. */
export function resolveGithubCopilotToken(): string | undefined { return process.env.GITHUB_COPILOT_TOKEN ?? process.env.GITHUB_TOKEN; }
