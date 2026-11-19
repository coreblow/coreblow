import type { ActiveProjectState, ChatThread, ModelTier, PermissionMode } from "../types/gateway";

const THREADS_KEY = "coreblow_studio_threads_v2";
const ACTIVE_THREAD_ID_KEY = "coreblow_studio_active_thread_id";
const PREFERENCES_KEY = "coreblow_studio_preferences_v2";
const PROJECT_KEY = "coreblow_studio_project_v2";

export interface AutomationSettings {
  repoHealth: boolean;
  memoryCompaction: boolean;
  evoloopDistillation: boolean;
  logPruning: boolean;
}

export interface UiPreferences {
  permissionMode: PermissionMode;
  modelTier: ModelTier;
  sidebarCollapsed: boolean;
  inspectorOpen: boolean;
  inspectorTab: "git" | "warroom" | "memory" | "corehub";
  anthropicApiKey?: string;
  openAiApiKey?: string;
  geminiApiKey?: string;
  groqApiKey?: string;
  localOllamaUrl?: string;
  customApiKey?: string;
  remoteHost?: string;
  remoteToken?: string;
  automations: AutomationSettings;
}

const DEFAULT_PREFERENCES: UiPreferences = {
  permissionMode: "Guarded",
  modelTier: "High Reasoning",
  sidebarCollapsed: false,
  inspectorOpen: true,
  inspectorTab: "git",
  localOllamaUrl: "http://127.0.0.1:11434",
  automations: {
    repoHealth: true,
    memoryCompaction: true,
    evoloopDistillation: true,
    logPruning: false,
  },
};

const DEFAULT_PROJECT: ActiveProjectState = {
  path: "/Users/febrinanda/coreblow",
  name: "coreblow",
  branch: "main",
  isGit: true,
  uncommittedFiles: 0,
};

export class StorageService {
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

  getPreferences(): UiPreferences {
    try {
      const data = localStorage.getItem(PREFERENCES_KEY);
      if (!data) return DEFAULT_PREFERENCES;
      const parsed = JSON.parse(data);
      return {
        ...DEFAULT_PREFERENCES,
        ...parsed,
        automations: {
          ...DEFAULT_PREFERENCES.automations,
          ...(parsed.automations || {}),
        },
      };
    } catch {
      return DEFAULT_PREFERENCES;
    }
  }

  savePreferences(prefs: Partial<UiPreferences>): void {
    try {
      const current = this.getPreferences();
      const updated = {
        ...current,
        ...prefs,
        automations: {
          ...current.automations,
          ...(prefs.automations || {}),
        },
      };
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
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
}

export const storageService = new StorageService();
