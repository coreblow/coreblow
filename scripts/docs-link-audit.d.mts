export function normalizeRoute(route: string): string;

export function resolveRoute(
  route: string,
  options?: { redirects?: Map<string, string>; routes?: Set<string> },
): { ok: boolean; terminal: string; loop?: boolean };

export function runDocsLinkAuditCli(options?: {
  args?: string[];
  spawnSyncImpl?: (
    command: string,
    args: string[],
    options: { cwd: string; stdio: string },
  ) => { status: number | null; error?: { code?: string } };
}): number;

export function auditDocsLinks(): {
  checked: number;
  broken: Array<{ file: string; line: number; link: string; reason: string }>;
};
