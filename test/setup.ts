import { vi } from "vitest";

// Minimal test setup - mock proprietary packages
vi.mock("@mariozechner/pi-ai", () => ({
  getOAuthApiKey: () => undefined,
  getOAuthProviders: () => [],
  loginOpenAICodex: vi.fn(),
  complete: vi.fn(),
  completeSimple: vi.fn(),
  streamSimple: vi.fn(),
  getModel: vi.fn(),
  getApiProvider: vi.fn(),
  getEnvApiKey: vi.fn(),
  registerApiProvider: vi.fn(),
  unregisterApiProviders: vi.fn(),
  createAssistantMessageEventStream: vi.fn(),
  streamAnthropic: vi.fn(),
  streamOpenAIResponses: vi.fn(),
  streamSimpleOpenAICompletions: vi.fn(),
}));

vi.mock("@mariozechner/pi-coding-agent", () => {
  // AuthStorage — needed by src/agents/pi-model-discovery.ts
  class AuthStorage {
    constructor() {}
    static inMemory(data?: unknown) { return new AuthStorage(); }
    getApiKey() { return ""; }
    setApiKey() {}
    listProviders() { return []; }
  }

  // ModelRegistry — needed by src/agents/pi-model-discovery.ts
  class ModelRegistry {
    constructor() {}
    find() { return null; }
    list() { return []; }
  }

  // PiCodingAgent needs AuthStorage & ModelRegistry as static props
  class PiCodingAgent {
    static AuthStorage = AuthStorage;
    static ModelRegistry = ModelRegistry;
  }

  return {
    AuthStorage,
    ModelRegistry,
    PiCodingAgent,
    SessionManager: class {
      constructor() {}
      static open() {
        return {
          getLeafEntry: () => null,
          branch: () => "branch-id",
          resetLeaf: () => {},
          buildSessionContext: () => ({}),
          sessions: [],
          save: () => {},
        };
      }
      open() {} list() {} get() {} create() {} delete() {} save() {} close() {}
    },
    SettingsManager: class { constructor() {} get() { return null; } set() {} getAll() { return {}; } },
    DefaultResourceLoader: class {},
    AgentSession: class {},
    CompactionEntry: class {},
    ContextEvent: class {},
    ExtensionAPI: class {},
    ExtensionContext: class {},
    ExtensionFactory: class {},
    FileOperations: class {},
    Skill: class {},
    ToolDefinition: class {},
    createAgentSession: vi.fn(),
    createEditTool: vi.fn(() => ({})),
    createReadTool: vi.fn(() => ({})),
    createWriteTool: vi.fn(),
    createSyntheticSourceInfo: vi.fn(),
    codingTools: [],
    readTool: vi.fn(),
    loadSkillsFromDir: vi.fn(() => []),
    formatSkillsForPrompt: vi.fn(() => ""),
    CURRENT_SESSION_VERSION: 1,
  };
});

vi.mock("@mariozechner/pi-agent-core", () => ({
  estimateTokens: vi.fn(() => 0),
  ndJsonStream: vi.fn(),
}));

vi.mock("@mariozechner/pi-tui", () => ({
  Container: class {
    constructor() {}
    children: unknown[] = [];
    addChild(c: unknown) { this.children.push(c); }
    removeChild() {}
    clear() { this.children = []; }
    render(width: number) {
      return this.children.map((c: any) => c?.text ?? c?.getText?.() ?? "").filter(Boolean);
    }
  },
  Box: class { constructor() {} },
  Text: class {
    text = "";
    constructor(text?: string) { this.text = text ?? ""; }
    setText(t: string) { this.text = t; }
    getText() { return this.text; }
  },
  Markdown: class {
    text = "";
    constructor(text?: string) { this.text = text ?? ""; }
    getText() { return this.text; }
  },
  Spacer: class { constructor() {} },
  Editor: class { constructor() {} getText() { return ""; } setText() {} },
  SelectList: class { constructor() {} },
  SettingsList: class { constructor() {} },
  Component: class {
    constructor() {}
    children: unknown[] = [];
    addChild(c: unknown) { this.children.push(c); }
    removeChild() {}
    clear() { this.children = []; }
    render(width: number) {
      return this.children.map((c: any) => c?.text ?? c?.getText?.() ?? "").filter(Boolean);
    }
  },
  TUI: class { constructor() {} requestRender() {} },
  Key: class { constructor() {} },
  Input: class { constructor() {} },
  ProcessTerminal: class { constructor() {} },
  Loader: class { constructor() {} },
  CombinedAutocompleteProvider: class { constructor() {} },
  matchesKey: vi.fn(),
  isKeyRelease: vi.fn(),
  truncateToWidth: vi.fn((s: string) => s),
  PiTui: class {},
}));
