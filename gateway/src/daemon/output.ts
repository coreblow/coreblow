/**
 * src/daemon/output.ts
 * Output formatting for daemon actions.
 * Ported from CoreBlow daemon/output.ts.
 */

export const toPosixPath = (value: string) => value.replace(/\\/g, "/");

export function formatLine(label: string, value: string): string {
    // Basic terminal format without external theme dep
    return `\x1b[90m${label}:\x1b[0m \x1b[36m${value}\x1b[0m`;
}

export function writeFormattedLines(
    stdout: NodeJS.WritableStream,
    lines: Array<{ label: string; value: string }>,
    opts?: { leadingBlankLine?: boolean },
): void {
    if (opts?.leadingBlankLine) {
        stdout.write("\n");
    }
    for (const line of lines) {
        stdout.write(`${formatLine(line.label, line.value)}\n`);
    }
}
