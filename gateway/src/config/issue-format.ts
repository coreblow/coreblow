/** CoreBlow — Config Issue Formatting */
export type IssueSeverity = "error" | "warning" | "info";
export interface ConfigIssue { severity: IssueSeverity; path: string; message: string; suggestion?: string; }
export function formatConfigIssue(issue: ConfigIssue): string { const icon = issue.severity === "error" ? "❌" : issue.severity === "warning" ? "⚠️" : "ℹ️"; return icon + " " + issue.path + ": " + issue.message + (issue.suggestion ? " → " + issue.suggestion : ""); }
export function formatConfigIssues(issues: ConfigIssue[]): string { return issues.map(formatConfigIssue).join("\n"); }
