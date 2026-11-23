import type { ActiveProjectState, ChatThread, ModelTier, PermissionMode } from "../types/gateway";

const THREADS_KEY = "coreblow_studio_threads_v2";
const ACTIVE_THREAD_ID_KEY = "coreblow_studio_active_thread_id";
const PREFERENCES_KEY = "coreblow_studio_preferences_v2";
const PROJECT_KEY = "coreblow_studio_project_v2";

const SENSITIVE_FIELDS: Array<keyof UiPreferences> = [
  "anthropicApiKey",
  "openAiApiKey",
  "geminiApiKey",
  "groqApiKey",
  "customApiKey",
  "remoteToken",
  "tavilyApiKey",
  "exaApiKey",
  "braveApiKey",
  "perplexityApiKey",
  "e2bApiKey",
  "modalApiKey",
  "daytonaApiKey",
];

const ENC_PREFIX = "enc:v1:";

export interface AutomationSettings {
  repoHealth: boolean;
  memoryCompaction: boolean;
  evoloopDistillation: boolean;
  logPruning: boolean;
}

export interface UiPreferences {
  permissionMode: PermissionMode;
  modelTier: ModelTier;
  activeModel?: string;
  agentTeamwork?: boolean;
  executionMode?: "standard" | "autonomous" | "warroom";
  setupCompleted?: boolean;
  onboardingCompleted?: boolean;
  userName?: string;
  accentColor?: string;
  themeMode?: "dark" | "light";
  layoutMode?: "basic" | "pro";
  sidebarCollapsed: boolean;
  inspectorOpen: boolean;
  inspectorTab:
    | "start"
    | "files"
    | "terminal"
    | "browser"
    | "git"
    | "warroom"
    | "memory"
    | "corehub";
  anthropicApiKey?: string;
  openAiApiKey?: string;
  geminiApiKey?: string;
  groqApiKey?: string;
  localOllamaUrl?: string;
  customApiKey?: string;
  remoteHost?: string;
  remoteToken?: string;
  automations: AutomationSettings;

  // General & Appearance
  terminalFontFamily?: string;
  terminalFontSize?: number;
  desktopNotifications?: boolean;

  // Models & Reasoning
  defaultReasoningEffort?: "Low" | "Medium" | "High" | "Max";
  mainContextWindowOverride?: number;
  auxiliaryModel?: string;
  maxSubagentDepth?: number;
  maxParallelSubagents?: number;

  // Memory & Context
  memoryBackend?: "builtin" | "qmd";
  memoryCitations?: "auto" | "always" | "off";
  contextCompressionEnabled?: boolean;
  contextCompressionThresholdPct?: number;
  protectLastMessages?: number;

  // Workspace & Browser
  defaultWorkspaceCwd?: string;
  persistentShell?: boolean;
  repoScanExclusions?: string;
  browserMode?: "headless" | "headed";
  browserUseRealProfile?: boolean;
  browserPrivateUrlGuard?: boolean;

  // Safety & Permissions
  approvalTimeoutSec?: number;
  commandAllowlist?: string;
  commandDenylist?: string;
  secretRedactionEnabled?: boolean;
  checkpointSnapshotLimit?: number;

  // External Tool API Keys
  tavilyApiKey?: string;
  exaApiKey?: string;
  braveApiKey?: string;
  perplexityApiKey?: string;
  e2bApiKey?: string;
  modalApiKey?: string;
  daytonaApiKey?: string;

  // Gateways & Remotes
  connectionMode?: "local" | "remote" | "ssh";
  activeRemoteNodeId?: string;
  sshTunnelHost?: string;
  sshTunnelUser?: string;
  sshTunnelPort?: number;
  sshTunnelRemotePort?: number;
  sshTunnelIdentityFile?: string;
  encryptSecretsWithKeychain?: boolean;
}

export const DEFAULT_PREFERENCES: UiPreferences = {
  permissionMode: "Guarded",
  modelTier: "High Reasoning",
  activeModel: "Auto (DecisionRouter)",
  agentTeamwork: false,
  executionMode: "standard",
  setupCompleted: false,
  onboardingCompleted: false,
  userName: "",
  accentColor: "#2DD4BF",
  themeMode: "dark",
  layoutMode: "basic",
  sidebarCollapsed: false,
  inspectorOpen: false,
  inspectorTab: "start",
  localOllamaUrl: "http://127.0.0.1:11434",
  automations: {
    repoHealth: true,
    memoryCompaction: true,
    evoloopDistillation: true,
    logPruning: false,
  },

  terminalFontFamily: "JetBrains Mono",
  terminalFontSize: 13,
  desktopNotifications: true,

  defaultReasoningEffort: "Medium",
  mainContextWindowOverride: 0,
  auxiliaryModel: "coreblow/fast",
  maxSubagentDepth: 2,
  maxParallelSubagents: 4,

  memoryBackend: "builtin",
  memoryCitations: "auto",
  contextCompressionEnabled: true,
  contextCompressionThresholdPct: 80,
  protectLastMessages: 6,

  defaultWorkspaceCwd: "",
  persistentShell: true,
  repoScanExclusions: "node_modules, .git, dist, build, release",
  browserMode: "headless",
  browserUseRealProfile: false,
  browserPrivateUrlGuard: true,

  approvalTimeoutSec: 60,
  commandAllowlist: "git status, git diff, pnpm test, ls",
  commandDenylist: "rm -rf /, sudo rm, mkfs",
  secretRedactionEnabled: true,
  checkpointSnapshotLimit: 20,

  connectionMode: "local",
  activeRemoteNodeId: "local",
  sshTunnelHost: "",
  sshTunnelUser: "",
  sshTunnelPort: 22,
  sshTunnelRemotePort: 18789,
  sshTunnelIdentityFile: "~/.ssh/id_ed25519",
  encryptSecretsWithKeychain: true,
};

const DEFAULT_PROJECT: ActiveProjectState = {
  path: "~",
  name: "Default workspace",
  branch: "main",
  isGit: false,
  uncommittedFiles: 0,
};

export class StorageService {
  private decryptedCache: Record<string, string> = {};

  getThreads(): ChatThread[] {
    try {
      const data = localStorage.getItem(THREADS_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  saveThreads(threads: ChatThread[]): void {
    try {
      localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
    } catch (err) {
      console.error("Failed to save threads to storage", err);
    }
  }

  getActiveThreadId(): string | null {
    try {
      return localStorage.getItem(ACTIVE_THREAD_ID_KEY);
    } catch {
      return null;
    }
  }

  setActiveThreadId(id: string | null): void {
    try {
      if (id) {
        localStorage.setItem(ACTIVE_THREAD_ID_KEY, id);
      } else {
        localStorage.removeItem(ACTIVE_THREAD_ID_KEY);
      }
    } catch (err) {
      console.error("Failed to set active thread id", err);
    }
  }

  /**
   * Initializes OS Keychain Vault, transparently decrypts any enc:v1: secrets
   * and migrates any plaintext credentials to encrypted storage.
   */
  async initVault(): Promise<UiPreferences> {
    if (typeof window === "undefined" || !window.coreblowDesktop?.vault) {
      return this.getPreferences();
    }

    try {
      const vault = window.coreblowDesktop.vault;
      const isAvailable = await vault.isAvailable();
      if (!isAvailable) {
        return this.getPreferences();
      }

      const raw = localStorage.getItem(PREFERENCES_KEY);
      if (!raw) {
        return this.getPreferences();
      }

      const parsed = JSON.parse(raw) as Record<string, unknown>;
      let shouldMigrateDisk = false;

      for (const field of SENSITIVE_FIELDS) {
        const val = parsed[field];
        if (typeof val === "string" && val.length > 0) {
          if (val.startsWith(ENC_PREFIX)) {
            const cipher = val.slice(ENC_PREFIX.length);
            const plain = await vault.decrypt(cipher);
            this.decryptedCache[field] = plain;
          } else {
            // Transparent migration of legacy plaintext credential to OS Keychain
            const cipher = await vault.encrypt(val);
            this.decryptedCache[field] = val;
            parsed[field] = `${ENC_PREFIX}${cipher}`;
            shouldMigrateDisk = true;
          }
        }
      }

      if (shouldMigrateDisk) {
        localStorage.setItem(PREFERENCES_KEY, JSON.stringify(parsed));
      }
    } catch (err) {
      console.warn("Vault initialization error:", err);
    }

    return this.getPreferences();
  }

  /**
   * Clears the in-memory decrypted credentials cache.
   */
  resetCache(): void {
    this.decryptedCache = {};
  }

  getPreferences(): UiPreferences {
    try {
      const data = localStorage.getItem(PREFERENCES_KEY);
      const threadsData = localStorage.getItem(THREADS_KEY);
      const hasExistingThreads = Boolean(
        threadsData && threadsData.length > 2 && threadsData !== "[]",
      );

      if (!data) {
        if (hasExistingThreads) {
          return {
            ...DEFAULT_PREFERENCES,
            setupCompleted: true,
            onboardingCompleted: true,
            layoutMode: "pro",
            inspectorOpen: true,
          };
        }
        return DEFAULT_PREFERENCES;
      }

      const parsed = JSON.parse(data);
      const setupCompleted = parsed.setupCompleted ?? (hasExistingThreads ? true : false);
      const onboardingCompleted = parsed.onboardingCompleted ?? (hasExistingThreads ? true : false);
      const layoutMode = parsed.layoutMode ?? (hasExistingThreads ? "pro" : "basic");

      // Resolve sensitive credentials from in-memory decrypted cache if present
      const resolvedSecrets: Record<string, string> = {};
      for (const field of SENSITIVE_FIELDS) {
        if (this.decryptedCache[field] !== undefined) {
          resolvedSecrets[field] = this.decryptedCache[field];
        } else if (typeof parsed[field] === "string") {
          const rawVal = parsed[field] as string;
          // If not prefixed, it's plaintext
          if (!rawVal.startsWith(ENC_PREFIX)) {
            resolvedSecrets[field] = rawVal;
          }
        }
      }

      return {
        ...DEFAULT_PREFERENCES,
        ...parsed,
        ...resolvedSecrets,
        setupCompleted,
        onboardingCompleted,
        layoutMode,
        automations: {
          ...DEFAULT_PREFERENCES.automations,
          ...parsed.automations,
        },
      };
    } catch {
      return DEFAULT_PREFERENCES;
    }
  }

  savePreferences(prefs: Partial<UiPreferences>): void {
    try {
      const current = this.getPreferences();

      // Update in-memory decrypted cache for any modified sensitive fields
      for (const field of SENSITIVE_FIELDS) {
        if (typeof prefs[field] === "string") {
          this.decryptedCache[field] = prefs[field] as string;
        }
      }

      const updated = {
        ...current,
        ...prefs,
        automations: {
          ...current.automations,
          ...prefs.automations,
        },
      };

      // Synchronous write of updated state
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));

      // Asynchronously encrypt sensitive fields with OS Keychain if available
      if (typeof window !== "undefined" && window.coreblowDesktop?.vault) {
        const vault = window.coreblowDesktop.vault;
        void (async () => {
          try {
            const isAvail = await vault.isAvailable();
            if (!isAvail) return;

            const storedRaw = localStorage.getItem(PREFERENCES_KEY);
            if (!storedRaw) return;
            const toEncrypt = JSON.parse(storedRaw) as Record<string, unknown>;
            let mutated = false;

            for (const field of SENSITIVE_FIELDS) {
              const plainVal = this.decryptedCache[field] ?? toEncrypt[field];
              if (typeof plainVal === "string" && plainVal && !plainVal.startsWith(ENC_PREFIX)) {
                const cipher = await vault.encrypt(plainVal);
                toEncrypt[field] = `${ENC_PREFIX}${cipher}`;
                mutated = true;
              }
            }

            if (mutated) {
              localStorage.setItem(PREFERENCES_KEY, JSON.stringify(toEncrypt));
            }
          } catch {
            // Silently fall back to standard storage
          }
        })();
      }
    } catch (err) {
      console.error("Failed to save preferences", err);
    }
  }

  getProject(): ActiveProjectState {
    try {
      const data = localStorage.getItem(PROJECT_KEY);
      if (!data) return DEFAULT_PROJECT;
      return { ...DEFAULT_PROJECT, ...JSON.parse(data) };
    } catch {
      return DEFAULT_PROJECT;
    }
  }

  saveProject(project: ActiveProjectState): void {
    try {
      localStorage.setItem(PROJECT_KEY, JSON.stringify(project));
    } catch (err) {
      console.error("Failed to save active project", err);
    }
  }

  /**
   * Exports non-secret preferences as formatted JSON.
   * Explicitly strips all SENSITIVE_FIELDS so credentials/API keys are never exported.
   */
  exportPreferencesJson(): string {
    const prefs = this.getPreferences();
    const exportable: Record<string, unknown> = { ...prefs };
    for (const key of SENSITIVE_FIELDS) {
      delete exportable[key];
    }
    return JSON.stringify(exportable, null, 2);
  }

  /**
   * Imports and validates preferences JSON, strips unknown or sensitive keys,
   * merges with current preferences, saves, and returns updated preferences.
   */
  importPreferencesJson(rawJson: string): {
    ok: boolean;
    error?: string;
    preferences?: UiPreferences;
  } {
    try {
      const parsed = JSON.parse(rawJson);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { ok: false, error: "Invalid JSON configuration format." };
      }
      const sanitized: Record<string, unknown> = { ...parsed };
      for (const key of SENSITIVE_FIELDS) {
        delete sanitized[key];
      }
      this.savePreferences(sanitized as Partial<UiPreferences>);
      const updated = this.getPreferences();
      return { ok: true, preferences: updated };
    } catch (err: any) {
      return { ok: false, error: err?.message || "Failed to parse JSON configuration file." };
    }
  }
}

export const storageService = new StorageService();
