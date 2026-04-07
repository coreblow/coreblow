/**
 * src/daemon/adapters/launchd-plist.ts
 * Apple LaunchAgent Plist construction and parsing.
 * Ported from CoreBlow daemon/launchd-plist.ts.
 */

import fs from "node:fs/promises";

// launchd applies ThrottleInterval to any rapid relaunch, including
// intentional gateway restarts. Keep it low so CLI restarts and forced
// reinstalls do not stall for a full minute.
export const LAUNCH_AGENT_THROTTLE_INTERVAL_SECONDS = 1;
// launchd stores plist integer values in decimal; 0o077 renders as 63 (owner-only files).
export const LAUNCH_AGENT_UMASK_DECIMAL = 0o077;

const plistEscape = (value: string): string =>
    value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");

const plistUnescape = (value: string): string =>
    value
        .replaceAll("&apos;", "'")
        .replaceAll("&quot;", '"')
        .replaceAll("&gt;", ">")
        .replaceAll("&lt;", "<")
        .replaceAll("&amp;", "&");

const renderEnvDict = (env: Record<string, string | undefined> | undefined): string => {
    if (!env) return "";

    const entries = Object.entries(env).filter(
        ([, value]) => typeof value === "string" && value.trim(),
    );
    if (entries.length === 0) return "";

    const items = entries
        .map(
            ([key, value]) =>
                `\n    <key>${plistEscape(key)}</key>\n    <string>${plistEscape(value?.trim() ?? "")}</string>`,
        )
        .join("");
    return `\n    <key>EnvironmentVariables</key>\n    <dict>${items}\n    </dict>`;
};

export async function readLaunchAgentProgramArgumentsFromFile(plistPath: string): Promise<{
    programArguments: string[];
    workingDirectory?: string;
    environment?: Record<string, string>;
    sourcePath?: string;
} | null> {
    try {
        const plist = await fs.readFile(plistPath, "utf8");
        const programMatch = plist.match(/<key>ProgramArguments<\/key>\s*<array>([\s\S]*?)<\/array>/i);
        if (!programMatch) return null;

        const args = Array.from(programMatch[1].matchAll(/<string>([\s\S]*?)<\/string>/gi)).map(
            (match) => plistUnescape(match[1] ?? "").trim(),
        );
        const workingDirMatch = plist.match(
            /<key>WorkingDirectory<\/key>\s*<string>([\s\S]*?)<\/string>/i,
        );
        const workingDirectory = workingDirMatch ? plistUnescape(workingDirMatch[1] ?? "").trim() : "";
        const envMatch = plist.match(/<key>EnvironmentVariables<\/key>\s*<dict>([\s\S]*?)<\/dict>/i);
        const environment: Record<string, string> = {};
        
        if (envMatch) {
            for (const pair of envMatch[1].matchAll(
                /<key>([\s\S]*?)<\/key>\s*<string>([\s\S]*?)<\/string>/gi,
            )) {
                const key = plistUnescape(pair[1] ?? "").trim();
                if (!key) continue;
                
                const value = plistUnescape(pair[2] ?? "").trim();
                environment[key] = value;
            }
        }
        
        return {
            programArguments: args.filter(Boolean),
            ...(workingDirectory ? { workingDirectory } : {}),
            ...(Object.keys(environment).length > 0 ? { environment } : {}),
            sourcePath: plistPath,
        };
    } catch {
        return null;
    }
}

export function buildLaunchAgentPlist({
    label,
    comment,
    programArguments,
    workingDirectory,
    stdoutPath,
    stderrPath,
    environment,
}: {
    label: string;
    comment?: string;
    programArguments: string[];
    workingDirectory?: string;
    stdoutPath: string;
    stderrPath: string;
    environment?: Record<string, string | undefined>;
}): string {
    const argsXml = programArguments
        .map((arg) => `\n      <string>${plistEscape(arg)}</string>`)
        .join("");
    const workingDirXml = workingDirectory
        ? `\n    <key>WorkingDirectory</key>\n    <string>${plistEscape(workingDirectory)}</string>`
        : "";
    const commentXml = comment?.trim()
        ? `\n    <key>Comment</key>\n    <string>${plistEscape(comment.trim())}</string>`
        : "";
    const envXml = renderEnvDict(environment);
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${plistEscape(label)}</string>
    ${commentXml}
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>ThrottleInterval</key>
    <integer>${LAUNCH_AGENT_THROTTLE_INTERVAL_SECONDS}</integer>
    <key>Umask</key>
    <integer>${LAUNCH_AGENT_UMASK_DECIMAL}</integer>
    <key>ProgramArguments</key>
    <array>${argsXml}
    </array>
    ${workingDirXml}
    <key>StandardOutPath</key>
    <string>${plistEscape(stdoutPath)}</string>
    <key>StandardErrorPath</key>
    <string>${plistEscape(stderrPath)}</string>${envXml}
  </dict>
</plist>
`;
}
