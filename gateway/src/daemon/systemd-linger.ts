/**
 * src/daemon/systemd-linger.ts
 * systemd user linger management.
 * Ported from CoreBlow daemon/systemd-linger.ts.
 */

import os from "node:os";
import { execFileUtf8 } from "./exec-file.js";

function resolveLoginctlUser(env: Record<string, string | undefined>): string | null {
    const fromEnv = env.USER?.trim() || env.LOGNAME?.trim();
    if (fromEnv) return fromEnv;
    try {
        return os.userInfo().username;
    } catch {
        return null;
    }
}

export type SystemdUserLingerStatus = {
    user: string;
    linger: "yes" | "no";
};

export async function readSystemdUserLingerStatus(
    env: Record<string, string | undefined>,
): Promise<SystemdUserLingerStatus | null> {
    const user = resolveLoginctlUser(env);
    if (!user) return null;
    try {
        const { stdout } = await execFileUtf8("loginctl", ["show-user", user, "-p", "Linger"], {
            timeout: 5_000,
        });
        const line = stdout
            .split("\n")
            .map((entry) => entry.trim())
            .find((entry) => entry.startsWith("Linger="));
        const value = line?.split("=")[1]?.trim().toLowerCase();
        if (value === "yes" || value === "no") {
            return { user, linger: value };
        }
    } catch {
        // ignore; loginctl may be unavailable
    }
    return null;
}

export async function enableSystemdUserLinger(params: {
    env: Record<string, string | undefined>;
    user?: string;
    sudoMode?: "prompt" | "non-interactive";
}): Promise<{ ok: boolean; stdout: string; stderr: string; code: number }> {
    const user = params.user ?? resolveLoginctlUser(params.env);
    if (!user) {
        return { ok: false, stdout: "", stderr: "Missing user", code: 1 };
    }
    const needsSudo = typeof process.getuid === "function" ? process.getuid() !== 0 : true;
    const sudoArgs =
        needsSudo && params.sudoMode !== undefined
            ? ["sudo", ...(params.sudoMode === "non-interactive" ? ["-n"] : [])]
            : [];
    const argv = [...sudoArgs, "loginctl", "enable-linger", user];
    
    // argv[0] is the executable, argv.slice(1) are the args
    const exe = argv[0] as string;
    const args = argv.slice(1);

    try {
        const result = await execFileUtf8(exe, args, { timeout: 30_000 });
        return {
            ok: result.code === 0,
            stdout: result.stdout,
            stderr: result.stderr,
            code: result.code ?? 1,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, stdout: "", stderr: message, code: 1 };
    }
}
