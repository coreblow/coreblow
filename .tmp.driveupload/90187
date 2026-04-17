/**
 * hooks/types.ts — Unified hook type definitions.
 *
 * Mirrors CoreBlow's hooks/types.ts to provide a single source of truth
 * for all hook-related types across the hooks subsystem.
 */

// ─── Install Spec ────────────────────────────────────────────────

export type HookInstallSpec = {
    id?: string;
    kind: "bundled" | "npm" | "git";
    label?: string;
    package?: string;
    repository?: string;
    bins?: string[];
};

// ─── Metadata ────────────────────────────────────────────────────

export type CoreBlowHookMetadata = {
    always?: boolean;
    hookKey?: string;
    emoji?: string;
    homepage?: string;
    /** Events this hook handles (e.g., ["command:new", "session:start"]) */
    events: string[];
    /** Optional export name (default: "default") */
    export?: string;
    os?: string[];
    requires?: {
        bins?: string[];
        anyBins?: string[];
        env?: string[];
        config?: string[];
    };
    install?: HookInstallSpec[];
};

// ─── Invocation Policy ───────────────────────────────────────────

export type HookInvocationPolicy = {
    enabled: boolean;
};

// ─── Frontmatter ─────────────────────────────────────────────────

export type ParsedHookFrontmatter = Record<string, string>;

// ─── Hook ────────────────────────────────────────────────────────

export type HookSource = "coreblow-bundled" | "coreblow-managed" | "coreblow-workspace" | "coreblow-plugin";

export type Hook = {
    name: string;
    description: string;
    source: HookSource;
    pluginId?: string;
    filePath: string;     // Path to HOOK.md
    baseDir: string;      // Directory containing hook
    handlerPath: string;  // Path to handler module (handler.ts/js)
};

// ─── Hook Entry ──────────────────────────────────────────────────

export type HookEntry = {
    hook: Hook;
    frontmatter: ParsedHookFrontmatter;
    metadata?: CoreBlowHookMetadata;
    invocation?: HookInvocationPolicy;
};

// ─── Eligibility ─────────────────────────────────────────────────

export type HookEligibilityContext = {
    remote?: {
        platforms: string[];
        hasBin: (bin: string) => boolean;
        hasAnyBin: (bins: string[]) => boolean;
        note?: string;
    };
};

// ─── Snapshot ────────────────────────────────────────────────────

export type HookSnapshot = {
    hooks: Array<{ name: string; events: string[] }>;
    resolvedHooks?: Hook[];
    version?: number;
};
