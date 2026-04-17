/**
 * src/daemon/cmd-argv.ts
 * Command script argument parsing.
 * Ported from CoreBlow daemon/cmd-argv.ts.
 */

import { splitArgsPreservingQuotes } from "./arg-split.js";
import { assertNoCmdLineBreak } from "./cmd-set.js";

export function quoteCmdScriptArg(value: string): string {
    assertNoCmdLineBreak(value, "Command argument");
    if (!value) {
        return '""';
    }
    const escaped = value.replace(/"/g, '\\"').replace(/%/g, "%%").replace(/!/g, "^!");
    if (!/[ \t"&|<>^()%!]/g.test(value)) {
        return escaped;
    }
    return `"${escaped}"`;
}

export function unescapeCmdScriptArg(value: string): string {
    return value.replace(/\^!/g, "!").replace(/%%/g, "%");
}

export function parseCmdScriptCommandLine(value: string): string[] {
    return splitArgsPreservingQuotes(value, { escapeMode: "backslash-quote-only" }).map(
        unescapeCmdScriptArg,
    );
}
