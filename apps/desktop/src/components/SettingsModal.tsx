import React, { useState, useEffect, useRef, useMemo } from "react";
import type { UpdateStatus } from "../../electron/preload";
import { gatewayClient } from "../services/gateway-client";
import { storageService, type UiPreferences } from "../services/storage";
import type {
  CoreHubSkill,
  CredentialPoolPayload,
  CuratedMemoryFile,
  CuratedMemoryFileId,
  PermissionMode,
  RemoteNodeConfig,
  RemoteNodeKind,
} from "../types/gateway";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  CloseIcon,
  CoreBlowBrandSwirl,
  CoreBlowEmblem,
  DownloadIcon,
  FolderIcon,
  KeyIcon,
  McpConduitIcon,
  MemoryBrainIcon,
  RadioIcon,
  RefreshIcon,
  SearchIcon,
  ServerIcon,
  SettingsIcon,
  ShieldIcon,
  SkillsChipIcon,
  SparklesIcon,
  TrashIcon,
  UploadIcon,
} from "./Icons";
import { SettingGroup, SettingRow, ToggleSwitch } from "./SettingsPrimitives";

export type SettingsSection =
  | "general"
  | "models"
  | "models:main"
  | "models:fallback"
  | "models:subagents"
  | "memory"
  | "workspace"
  | "permissions"
  | "channels"
  | "skills"
  | "remotes"
  | "remotes:primary"
  | "remotes:saved"
  | "automations"
  | "about";

export interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  preferences: UiPreferences;
  onUpdatePreferences: (prefs: Partial<UiPreferences>) => void;
  initialSection?: SettingsSection;
  onRunSetupWizard?: () => void;
  updateStatus?: UpdateStatus | null;
  onCheckForUpdates?: () => void;
  onDownloadUpdate?: () => void;
  onInstallUpdate?: () => void;
}

const ACCENT_SWATCHES = [
  { name: "Teal", color: "#2DD4BF" },
  { name: "Emerald", color: "#10B981" },
  { name: "Sky", color: "#38BDF8" },
  { name: "Electric Blue", color: "#3B82F6" },
  { name: "Violet", color: "#8B5CF6" },
  { name: "Rose", color: "#EC4899" },
  { name: "Amber", color: "#F59E0B" },
  { name: "Safety Orange", color: "#F97316" },
];

interface SearchableSetting {
  id: string;
  section: SettingsSection;
  title: string;
  description: string;
  keywords: string[];
}

const SEARCH_INDEX: SearchableSetting[] = [
  {
    id: "theme",
    section: "general",
    title: "Appearance & Theme",
    description: "Dark/Light OLED theme and Sovereign Teal accent",
    keywords: ["theme", "dark", "light", "color", "accent", "oled"],
  },
  {
    id: "layout",
    section: "general",
    title: "Workspace Layout Mode",
    description: "Toggle Basic or Pro layout",
    keywords: ["layout", "pro", "basic", "dock", "screen"],
  },
  {
    id: "terminal-font",
    section: "general",
    title: "Terminal Font & Typography",
    description: "Terminal font family and font size",
    keywords: ["terminal", "font", "monospace", "jetbrains", "fira", "size"],
  },
  {
    id: "notifications",
    section: "general",
    title: "Desktop Notifications",
    description: "System alerts and execution notifications",
    keywords: ["notification", "alert", "sound", "bell"],
  },
  {
    id: "shortcuts",
    section: "general",
    title: "Keyboard Shortcuts",
    description: "Reference key combinations and hotkeys",
    keywords: ["keyboard", "shortcuts", "hotkeys", "keybind", "command"],
  },
  {
    id: "setup-wizard",
    section: "general",
    title: "Run Setup Wizard",
    description: "Rerun initial onboarding setup",
    keywords: ["setup", "wizard", "first run", "onboarding"],
  },

  {
    id: "model-active",
    section: "models:main",
    title: "Active Model & Tier",
    description: "Active model selection and model tier",
    keywords: ["model", "tier", "gpt", "claude", "gemini"],
  },
  {
    id: "model-reasoning",
    section: "models:main",
    title: "Default Reasoning Effort",
    description: "Set thinking effort (Low, Medium, High, Max)",
    keywords: ["reasoning", "thinking", "effort", "deepthink"],
  },
  {
    id: "model-context",
    section: "models:main",
    title: "Context Window Override",
    description: "Override main model context window token limit",
    keywords: ["context", "window", "override", "tokens", "limit"],
  },
  {
    id: "model-telemetry",
    section: "models:main",
    title: "Live Usage Telemetry",
    description: "Requests, tokens, failovers, estimated costs",
    keywords: ["telemetry", "usage", "cost", "token", "stats"],
  },

  {
    id: "model-fallback",
    section: "models:fallback",
    title: "Daybreak Provider Fallback Chain",
    description: "Automatic failover sequence when rate-limited",
    keywords: ["fallback", "failover", "chain", "daybreak"],
  },
  {
    id: "model-pools",
    section: "models:fallback",
    title: "Multi-Key Credential Pools",
    description: "Round-robin API key pools and health status",
    keywords: ["pool", "credential", "keys", "load balance"],
  },
  {
    id: "model-vault",
    section: "models:fallback",
    title: "Direct Vault Overrides",
    description: "Anthropic, OpenAI, Gemini, Groq, Ollama keys",
    keywords: ["api key", "anthropic", "openai", "gemini", "groq", "ollama"],
  },

  {
    id: "model-aux",
    section: "models:subagents",
    title: "Auxiliary Model",
    description: "Model for background summarization and compression",
    keywords: ["auxiliary", "fast", "background", "summary"],
  },
  {
    id: "model-subagents",
    section: "models:subagents",
    title: "Subagent Concurrency & Depth",
    description: "Maximum subagent tree depth and parallel children",
    keywords: ["subagent", "delegation", "depth", "concurrency", "parallel"],
  },

  {
    id: "memory-engine",
    section: "memory",
    title: "Memory Engine",
    description: "SQLite FTS5 vs QMD hybrid semantic index",
    keywords: ["memory", "engine", "qmd", "sqlite", "fts5", "vector"],
  },
  {
    id: "memory-citations",
    section: "memory",
    title: "Memory Citations Mode",
    description: "Citation annotations in responses",
    keywords: ["citations", "sources", "references"],
  },
  {
    id: "memory-compression",
    section: "memory",
    title: "Context Auto-Compression",
    description: "Threshold % and protected recent messages",
    keywords: ["compression", "compact", "threshold", "protect", "context"],
  },
  {
    id: "memory-curated-files",
    section: "memory",
    title: "USER.md / MEMORY.md Editor",
    description: "Curated markdown memory: USER.md, MEMORY.md, and CONSTRAINTS.md",
    keywords: ["user.md", "memory.md", "constraints", "profile", "curated", "markdown", "capacity"],
  },

  {
    id: "workspace-cwd",
    section: "workspace",
    title: "Default Workspace Working Directory",
    description: "Initial directory for terminal and execution",
    keywords: ["cwd", "workspace", "directory", "folder", "path"],
  },
  {
    id: "workspace-shell",
    section: "workspace",
    title: "Persistent Shell Session",
    description: "Keep environment and subprocess state between commands",
    keywords: ["shell", "persistent", "terminal", "zsh", "bash"],
  },
  {
    id: "workspace-scan",
    section: "workspace",
    title: "Repository Scan Exclusions",
    description: "Directories ignored during indexing",
    keywords: ["repo", "scan", "exclude", "ignore", "node_modules"],
  },
  {
    id: "browser-mode",
    section: "workspace",
    title: "Browser Execution Mode",
    description: "Headless vs headed browser automation",
    keywords: ["browser", "headless", "headed", "chrome", "playwright"],
  },
  {
    id: "browser-profile",
    section: "workspace",
    title: "Use Real Browser Profile",
    description: "Attach user Chrome or Edge profile with existing sessions",
    keywords: ["profile", "cookies", "login", "session"],
  },
  {
    id: "browser-ssrf",
    section: "workspace",
    title: "Private URL SSRF Guard",
    description: "Prevent agent from accessing internal LAN/loopback URLs",
    keywords: ["ssrf", "guard", "private", "security", "lan", "localhost"],
  },

  {
    id: "safety-boundary",
    section: "permissions",
    title: "Execution Boundary Profile",
    description: "Full access, Workspace, Guarded, Read-only",
    keywords: ["permission", "guarded", "full access", "read-only", "safety"],
  },
  {
    id: "safety-timeout",
    section: "permissions",
    title: "Tool Approval Timeout",
    description: "Seconds to wait before auto-cancelling prompt",
    keywords: ["timeout", "approval", "prompt", "wait"],
  },
  {
    id: "safety-redaction",
    section: "permissions",
    title: "Secret Redaction in Output",
    description: "Automatically mask API keys and passwords in logs",
    keywords: ["redaction", "secret", "mask", "censor", "hide"],
  },
  {
    id: "safety-checkpoint",
    section: "permissions",
    title: "Checkpoint Snapshot Limit",
    description: "Maximum rollback snapshots stored on disk",
    keywords: ["checkpoint", "rollback", "snapshot", "limit"],
  },
  {
    id: "safety-allowlist",
    section: "permissions",
    title: "Command Allowlist & Denylist",
    description: "Allowed and forbidden command patterns",
    keywords: ["allowlist", "denylist", "commands", "blacklist", "whitelist"],
  },

  {
    id: "channels-messaging",
    section: "channels",
    title: "Messaging Channels",
    description: "Telegram, Discord, Slack, WhatsApp Web, Signal, iMessage",
    keywords: ["channel", "telegram", "discord", "slack", "whatsapp", "signal", "imessage"],
  },
  {
    id: "channels-pairing",
    section: "channels",
    title: "Agent Pairing & Access Control",
    description: "Approve or revoke channel access requests",
    keywords: ["pairing", "access", "approve", "revoke", "dm"],
  },

  {
    id: "skills-tool-keys",
    section: "skills",
    title: "External Tool API Keys",
    description: "Tavily, Exa, Brave, Perplexity, E2B, Modal, Daytona",
    keywords: ["tavily", "exa", "brave", "perplexity", "e2b", "modal", "daytona", "tool keys"],
  },
  {
    id: "skills-storefront",
    section: "skills",
    title: "CoreHub Storefront & Installed Skills",
    description: "Domain tools and learned procedural skills",
    keywords: ["skills", "corehub", "learned", "tools"],
  },
  {
    id: "skills-mcp",
    section: "skills",
    title: "MCP Servers & Catalog",
    description: "Model Context Protocol connections and 1-click catalog",
    keywords: ["mcp", "servers", "catalog", "tools", "conduit"],
  },

  {
    id: "gateway-primary",
    section: "remotes:primary",
    title: "Primary Gateway",
    description: "Select connection mode: Local gateway, Remote node, or SSH tunnel",
    keywords: ["gateway", "primary", "connection", "daemon", "node"],
  },
  {
    id: "gateway-local",
    section: "remotes:primary",
    title: "Local Gateway",
    description: "Start a private CoreBlow daemon on localhost (:18789)",
    keywords: ["local", "gateway", "daemon", "localhost", "18789"],
  },
  {
    id: "gateway-remote",
    section: "remotes:primary",
    title: "Remote Node Gateway",
    description: "Connect to a 24/7 CoreBlow VPS, Tailscale, or Docker node",
    keywords: ["remote", "vps", "tailscale", "docker", "gateway"],
  },
  {
    id: "gateway-ssh",
    section: "remotes:primary",
    title: "SSH Tunnel Connection",
    description: "Tunnel securely over key-based SSH without exposing public ports",
    keywords: ["ssh", "tunnel", "port forward", "remote port", "identity key"],
  },
  {
    id: "gateway-keychain",
    section: "remotes:primary",
    title: "OS Keychain Secret Encryption",
    description: "Encrypt saved API keys and tokens with macOS Keychain / OS Vault",
    keywords: ["keychain", "vault", "encrypt", "secrets", "os", "security"],
  },
  {
    id: "gateway-diagnostics",
    section: "remotes:primary",
    title: "Diagnostics & Desktop Logs",
    description: "Reveal desktop logs in file manager for troubleshooting",
    keywords: ["diagnostics", "logs", "desktop.log", "debug", "troubleshooting", "open logs"],
  },
  {
    id: "gateway-saved-nodes",
    section: "remotes:saved",
    title: "Saved Remote Nodes",
    description: "Manage 24/7 VPS, Tailscale, and Docker gateway nodes with live probe and sync",
    keywords: ["remote", "nodes", "saved", "vps", "tailscale", "gateway", "probe", "sync"],
  },
  {
    id: "automations-cron",
    section: "automations",
    title: "Automations & Cron Jobs",
    description: "Background health checks, memory compaction, skill distillation",
    keywords: ["cron", "automation", "scheduled", "background", "jobs"],
  },
  {
    id: "about-coreblow",
    section: "about",
    title: "About CoreBlow Studio",
    description: "Version 2.6.0, Application ID, architecture, docs",
    keywords: ["about", "version", "docs", "coreblow", "license"],
  },
  {
    id: "software-updates",
    section: "general",
    title: "Software Updates",
    description: "Check for updates and automatic update notifications",
    keywords: ["update", "updates", "release", "check", "auto"],
  },
];

function describeUpdateStatus(status?: UpdateStatus | null): string {
  if (!status) return "Up to date";
  switch (status.phase) {
    case "checking":
      return "Checking...";
    case "available":
      return status.availableVersion
        ? `Update v${status.availableVersion} available`
        : "Update available";
    case "downloading":
      return `Downloading ${Math.round(status.progressPercent ?? 0)}%`;
    case "downloaded":
      return status.availableVersion
        ? `Ready to restart (v${status.availableVersion})`
        : "Ready to restart";
    case "error":
      return status.error ? `Offline (${status.error})` : "Offline";
    case "not-available":
    case "idle":
    default:
      return "Up to date";
  }
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
  preferences,
  onUpdatePreferences,
  initialSection = "general",
  onRunSetupWizard,
  updateStatus,
  onCheckForUpdates,
  onDownloadUpdate,
  onInstallUpdate,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);
  const [modelsExpanded, setModelsExpanded] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [utilityStatus, setUtilityStatus] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // CoreHub & Skills state
  const [skills, setSkills] = useState<CoreHubSkill[]>([]);
  const [learnedSkills, setLearnedSkills] = useState<CoreHubSkill[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);

  // Channels state
  const [channelsConfig, setChannelsConfig] = useState<
    Record<string, { enabled: boolean; token?: string; webhook?: string }>
  >(() => {
    try {
      const saved = localStorage.getItem("coreblow_channels_config");
      return saved
        ? JSON.parse(saved)
        : {
            Telegram: { enabled: false },
            Discord: { enabled: false },
            Slack: { enabled: false },
            "WhatsApp (Web)": { enabled: false },
            Signal: { enabled: false },
            iMessage: { enabled: false },
          };
    } catch {
      return {
        Telegram: { enabled: false },
        Discord: { enabled: false },
        Slack: { enabled: false },
        "WhatsApp (Web)": { enabled: false },
        Signal: { enabled: false },
        iMessage: { enabled: false },
      };
    }
  });
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);

  // Credential Pool & Fallback state
  const [poolData, setPoolData] = useState<CredentialPoolPayload | null>(null);
  const [loadingPool, setLoadingPool] = useState(false);
  const [newKeyProvider, setNewKeyProvider] = useState("anthropic");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [newKeyLabel, setNewKeyLabel] = useState("");

  // Remote Nodes state
  const [remotesExpanded, setRemotesExpanded] = useState<boolean>(true);
  const [connectionMode, setConnectionMode] = useState<"local" | "remote" | "ssh">(
    preferences.connectionMode ?? "local",
  );
  const [selectedRemoteNodeId, setSelectedRemoteNodeId] = useState<string>(
    preferences.activeRemoteNodeId ?? "local",
  );
  const [sshHost, setSshHost] = useState(preferences.sshTunnelHost ?? "");
  const [sshUser, setSshUser] = useState(preferences.sshTunnelUser ?? "");
  const [sshPort, setSshPort] = useState(preferences.sshTunnelPort ?? 22);
  const [sshRemotePort, setSshRemotePort] = useState(preferences.sshTunnelRemotePort ?? 18789);
  const [sshKeyPath, setSshKeyPath] = useState(
    preferences.sshTunnelIdentityFile ?? "~/.ssh/id_ed25519",
  );
  const [reconnectStatus, setReconnectStatus] = useState<string | null>(null);
  const [diagnosticsStatus, setDiagnosticsStatus] = useState<string | null>(null);

  const [remoteNodes, setRemoteNodes] = useState<RemoteNodeConfig[]>([]);
  const [loadingNodes, setLoadingNodes] = useState(false);
  const [newNodeName, setNewNodeName] = useState("");
  const [newNodeUrl, setNewNodeUrl] = useState("");
  const [newNodeKind, setNewNodeKind] = useState<RemoteNodeKind>("vps");
  const [newNodeToken, setNewNodeToken] = useState("");
  const [nodeActionStatus, setNodeActionStatus] = useState<string | null>(null);

  useEffect(() => {
    if (preferences.connectionMode) setConnectionMode(preferences.connectionMode);
    if (preferences.activeRemoteNodeId) setSelectedRemoteNodeId(preferences.activeRemoteNodeId);
    if (preferences.sshTunnelHost !== undefined) setSshHost(preferences.sshTunnelHost);
    if (preferences.sshTunnelUser !== undefined) setSshUser(preferences.sshTunnelUser);
    if (preferences.sshTunnelPort !== undefined) setSshPort(preferences.sshTunnelPort);
    if (preferences.sshTunnelRemotePort !== undefined)
      setSshRemotePort(preferences.sshTunnelRemotePort);
    if (preferences.sshTunnelIdentityFile !== undefined)
      setSshKeyPath(preferences.sshTunnelIdentityFile);
  }, [preferences]);

  // MCP Servers state
  const [mcpServers, setMcpServers] = useState<any[]>([]);
  const [mcpCatalog, setMcpCatalog] = useState<any[]>([]);
  const [loadingMcp, setLoadingMcp] = useState(false);
  const [mcpProbeStatus, setMcpProbeStatus] = useState<
    Record<string, { status: string; latencyMs?: number; error?: string }>
  >({});

  // Agent Pairing state
  const [pairingState, setPairingState] = useState<{ pending: any[]; approved: any[] }>({
    pending: [],
    approved: [],
  });
  const [loadingPairing, setLoadingPairing] = useState(false);
  const [channelTestStatus, setChannelTestStatus] = useState<
    Record<string, { testing?: boolean; message?: string; error?: string }>
  >({});

  const showUtilityMessage = (msg: string) => {
    setUtilityStatus(msg);
    setTimeout(() => setUtilityStatus(null), 3000);
  };

  const fetchMcpData = async () => {
    setLoadingMcp(true);
    try {
      const res = await gatewayClient.listMcpServers();
      if (res.ok) {
        setMcpServers(res.servers);
        setMcpCatalog(res.catalog);
      }
    } finally {
      setLoadingMcp(false);
    }
  };

  const fetchPairingData = async () => {
    setLoadingPairing(true);
    try {
      const res = await gatewayClient.listPairingState();
      if (res.ok) {
        setPairingState({ pending: res.pending, approved: res.approved });
      }
    } finally {
      setLoadingPairing(false);
    }
  };

  const fetchNodes = async () => {
    setLoadingNodes(true);
    try {
      const list = await gatewayClient.listNodes();
      setRemoteNodes(list);
    } finally {
      setLoadingNodes(false);
    }
  };

  const fetchPools = async () => {
    setLoadingPool(true);
    try {
      const data = await gatewayClient.getCredentialPools();
      if (data) setPoolData(data);
    } finally {
      setLoadingPool(false);
    }
  };

  // Curated Memory Files state
  const [memoryFiles, setMemoryFiles] = useState<CuratedMemoryFile[]>([]);
  const [memoryDrafts, setMemoryDrafts] = useState<Record<CuratedMemoryFileId, string>>({
    user: "",
    memory: "",
    constraints: "",
  });
  const [loadingMemoryFiles, setLoadingMemoryFiles] = useState(false);
  const [savingMemoryFiles, setSavingMemoryFiles] = useState<Record<CuratedMemoryFileId, boolean>>({
    user: false,
    memory: false,
    constraints: false,
  });
  const [resettingMemoryFiles, setResettingMemoryFiles] = useState<
    Record<CuratedMemoryFileId, boolean>
  >({
    user: false,
    memory: false,
    constraints: false,
  });
  const [memoryStatusMap, setMemoryStatusMap] = useState<
    Record<CuratedMemoryFileId, { text: string; ok: boolean } | null>
  >({
    user: null,
    memory: null,
    constraints: null,
  });

  const fetchMemoryFiles = async () => {
    setLoadingMemoryFiles(true);
    try {
      const files = await gatewayClient.getMemoryFiles();
      if (files && files.length > 0) {
        setMemoryFiles(files);
        setMemoryDrafts((prev) => {
          const drafts = { ...prev };
          for (const f of files) {
            drafts[f.id] = f.content;
          }
          return drafts;
        });
      }
    } finally {
      setLoadingMemoryFiles(false);
    }
  };

  const handleSaveMemoryFile = async (fileId: CuratedMemoryFileId) => {
    const content = memoryDrafts[fileId] ?? "";
    setSavingMemoryFiles((prev) => ({ ...prev, [fileId]: true }));
    setMemoryStatusMap((prev) => ({ ...prev, [fileId]: null }));
    try {
      const res = await gatewayClient.saveMemoryFile(fileId, content);
      if (res.ok && res.file) {
        setMemoryFiles((prev) => prev.map((f) => (f.id === fileId ? res.file! : f)));
        setMemoryStatusMap((prev) => ({ ...prev, [fileId]: { text: "Saved", ok: true } }));
      } else {
        setMemoryStatusMap((prev) => ({
          ...prev,
          [fileId]: { text: res.error || "Failed to save file", ok: false },
        }));
      }
    } finally {
      setSavingMemoryFiles((prev) => ({ ...prev, [fileId]: false }));
      setTimeout(() => {
        setMemoryStatusMap((prev) => ({ ...prev, [fileId]: null }));
      }, 3000);
    }
  };

  const handleResetMemoryFile = async (fileId: CuratedMemoryFileId) => {
    setResettingMemoryFiles((prev) => ({ ...prev, [fileId]: true }));
    setMemoryStatusMap((prev) => ({ ...prev, [fileId]: null }));
    try {
      const res = await gatewayClient.resetMemoryFile(fileId);
      if (res.ok && res.file) {
        setMemoryFiles((prev) => prev.map((f) => (f.id === fileId ? res.file! : f)));
        setMemoryDrafts((prev) => ({
          ...prev,
          [fileId]: res.file!.content,
        }));
        setMemoryStatusMap((prev) => ({
          ...prev,
          [fileId]: { text: "Reset to default", ok: true },
        }));
      } else {
        setMemoryStatusMap((prev) => ({
          ...prev,
          [fileId]: { text: res.error || "Failed to reset file", ok: false },
        }));
      }
    } finally {
      setResettingMemoryFiles((prev) => ({ ...prev, [fileId]: false }));
      setTimeout(() => {
        setMemoryStatusMap((prev) => ({ ...prev, [fileId]: null }));
      }, 3000);
    }
  };

  const handleRevertMemoryFile = (fileId: CuratedMemoryFileId) => {
    const file = memoryFiles.find((f) => f.id === fileId);
    if (file) {
      setMemoryDrafts((prev) => ({
        ...prev,
        [fileId]: file.content,
      }));
      setMemoryStatusMap((prev) => ({ ...prev, [fileId]: { text: "Reverted", ok: true } }));
      setTimeout(() => {
        setMemoryStatusMap((prev) => ({ ...prev, [fileId]: null }));
      }, 2000);
    }
  };

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
      if (initialSection.startsWith("models")) {
        setModelsExpanded(true);
      }
      if (initialSection.startsWith("remotes")) {
        setRemotesExpanded(true);
      }
    }
  }, [initialSection, open]);

  useEffect(() => {
    if (open) {
      if (activeSection === "remotes" || activeSection.startsWith("remotes")) fetchNodes();
      if (activeSection === "skills") {
        fetchMcpData();
        setLoadingSkills(true);
        Promise.all([gatewayClient.getStorefront(), gatewayClient.getLearnedSkills()])
          .then(([storefront, learned]) => {
            setSkills(storefront);
            setLearnedSkills(learned);
          })
          .finally(() => setLoadingSkills(false));
      }
      if (activeSection === "channels") fetchPairingData();
      if (activeSection.startsWith("models")) fetchPools();
      if (activeSection === "memory") fetchMemoryFiles();
    }
  }, [open, activeSection]);

  // Keyboard navigation: Escape closes search or modal, Cmd+K focuses search
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (searchQuery.trim()) {
          setSearchQuery("");
        } else {
          onClose();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, searchQuery, onClose]);

  // Filtered search results
  const filteredSearchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return SEARCH_INDEX.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.includes(q)),
    );
  }, [searchQuery]);

  // Handlers for Export / Import / Reload
  const handleExportSettings = () => {
    try {
      const json = storageService.exportPreferencesJson();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `coreblow-settings-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showUtilityMessage("Settings exported!");
    } catch {
      showUtilityMessage("Export failed.");
    }
  };

  const handleImportSettings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        const res = storageService.importPreferencesJson(content);
        if (res.ok && res.preferences) {
          onUpdatePreferences(res.preferences);
          showUtilityMessage("Settings imported!");
        } else {
          showUtilityMessage(res.error || "Import error");
        }
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleReloadConfig = async () => {
    await Promise.all([fetchPools(), fetchNodes(), fetchMcpData(), fetchPairingData()]);
    showUtilityMessage("Config reloaded!");
  };

  const handleToggleChannel = (name: string) => {
    setChannelsConfig((prev) => {
      const current = prev[name] || { enabled: false };
      const updated = {
        ...prev,
        [name]: { ...current, enabled: !current.enabled },
      };
      try {
        localStorage.setItem("coreblow_channels_config", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleSaveChannel = (name: string, data: { token?: string; webhook?: string }) => {
    setChannelsConfig((prev) => {
      const current = prev[name] || { enabled: false };
      const updated = {
        ...prev,
        [name]: { ...current, ...data, enabled: true },
      };
      try {
        localStorage.setItem("coreblow_channels_config", JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setExpandedChannel(null);
  };

  const handleAddPoolKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyValue.trim()) return;
    const ok = await gatewayClient.addCredentialPoolKey({
      providerId: newKeyProvider,
      apiKey: newKeyValue.trim(),
      label: newKeyLabel.trim() || undefined,
    });
    if (ok) {
      setNewKeyValue("");
      setNewKeyLabel("");
      await fetchPools();
    }
  };

  const handleDeletePoolKey = async (keyId: string) => {
    const ok = await gatewayClient.deleteCredentialPoolKey(keyId);
    if (ok) await fetchPools();
  };

  const handleMoveFallback = async (index: number, direction: -1 | 1) => {
    if (!poolData) return;
    const chain = [...poolData.fallbackChain];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= chain.length) return;
    const temp = chain[index];
    chain[index] = chain[targetIdx];
    chain[targetIdx] = temp;
    await gatewayClient.saveFallbackChain(chain);
    await fetchPools();
  };

  const handleInstallMcp = async (catalogId: string) => {
    await gatewayClient.installMcpServer({ catalogId });
    await fetchMcpData();
  };

  const handleDeleteMcp = async (id: string) => {
    await gatewayClient.deleteMcpServer(id);
    await fetchMcpData();
  };

  const handleProbeMcp = async (id: string) => {
    setMcpProbeStatus((prev) => ({ ...prev, [id]: { status: "probing" } }));
    const res = await gatewayClient.probeMcpServer(id);
    if (res.ok && res.probe) {
      setMcpProbeStatus((prev) => ({
        ...prev,
        [id]: { status: res.probe.status, latencyMs: res.probe.latencyMs, error: res.probe.error },
      }));
    } else {
      setMcpProbeStatus((prev) => ({
        ...prev,
        [id]: { status: "error", error: res.error || "Probe failed" },
      }));
    }
    await fetchMcpData();
  };

  const handleApprovePairing = async (codeOrId: string) => {
    await gatewayClient.approvePairing(codeOrId);
    await fetchPairingData();
  };

  const handleRevokePairing = async (externalUserId: string) => {
    await gatewayClient.revokePairing(externalUserId);
    await fetchPairingData();
  };

  const handleTestChannel = async (platform: string, inputToken?: string) => {
    setChannelTestStatus((prev) => ({ ...prev, [platform]: { testing: true } }));
    const res = await gatewayClient.testChannel(platform, inputToken);
    if (res.ok) {
      setChannelTestStatus((prev) => ({
        ...prev,
        [platform]: { testing: false, message: res.message || "Connected successfully!" },
      }));
    } else {
      setChannelTestStatus((prev) => ({
        ...prev,
        [platform]: { testing: false, error: res.error || "Connection test failed." },
      }));
    }
  };

  if (!open) return null;

  // Compute breadcrumbs
  const getBreadcrumbTitle = () => {
    switch (activeSection) {
      case "general":
        return "General";
      case "models":
      case "models:main":
        return "Models > Main & Reasoning";
      case "models:fallback":
        return "Models > Fallback & Pools";
      case "models:subagents":
        return "Models > Auxiliary & Subagents";
      case "memory":
        return "Memory & Context";
      case "workspace":
        return "Workspace & Browser";
      case "permissions":
        return "Safety & Permissions";
      case "channels":
        return "Channels";
      case "skills":
        return "Skills & Tool Keys";
      case "remotes":
      case "remotes:primary":
        return "Gateways > Primary gateway";
      case "remotes:saved":
        return "Gateways > Saved nodes";
      case "automations":
        return "Automations";
      case "about":
        return "About";
      default:
        return "General";
    }
  };

  const currentModelsSubView =
    activeSection === "models:fallback"
      ? "fallback"
      : activeSection === "models:subagents"
        ? "subagents"
        : "main";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(14px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(960px, calc(100vw - 48px))",
          height: "min(760px, calc(100vh - 48px))",
          background: "var(--bg-card)",
          border: "1px solid var(--border-medium)",
          borderRadius: "var(--radius-panel, 14px)",
          boxShadow: "var(--shadow-composer)",
          display: "grid",
          gridTemplateColumns: "228px 1fr",
          gridTemplateRows: "52px 1fr",
          overflow: "hidden",
        }}
      >
        {/* Top Left Header */}
        <div
          style={{
            background: "var(--bg-sidebar)",
            borderBottom: "1px solid var(--border-subtle)",
            borderRight: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: "var(--ink-primary)",
          }}
        >
          SETTINGS
        </div>

        {/* Top Right Header: Breadcrumbs + Search Input + Close */}
        <div
          style={{
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px 0 20px",
            gap: "16px",
            background: "var(--bg-card)",
          }}
        >
          {/* Breadcrumb Path */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--ink-primary)",
              minWidth: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <span style={{ color: "var(--ink-muted)" }}>Settings</span>
            <ChevronRightIcon size={12} color="var(--ink-muted)" />
            {activeSection.startsWith("models") ? (
              <>
                <span style={{ color: "var(--ink-muted)" }}>Models</span>
                <ChevronRightIcon size={12} color="var(--ink-muted)" />
                <span>
                  {activeSection === "models:fallback"
                    ? "Fallback & Pools"
                    : activeSection === "models:subagents"
                      ? "Auxiliary & Subagents"
                      : "Main & Reasoning"}
                </span>
              </>
            ) : activeSection.startsWith("remotes") || activeSection === "remotes" ? (
              <>
                <span style={{ color: "var(--ink-muted)" }}>Gateways</span>
                <ChevronRightIcon size={12} color="var(--ink-muted)" />
                <span>{activeSection === "remotes:saved" ? "Saved nodes" : "Primary gateway"}</span>
              </>
            ) : (
              <span>{getBreadcrumbTitle()}</span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
            {/* Search Input */}
            <div style={{ position: "relative", width: "240px" }}>
              <div
                style={{
                  position: "absolute",
                  left: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  color: "var(--ink-muted)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <SearchIcon size={13} />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search settings... (⌘K)"
                style={{
                  width: "100%",
                  height: "28px",
                  padding: "0 8px 0 28px",
                  borderRadius: "6px",
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-medium)",
                  color: "var(--ink-primary)",
                  fontSize: "12px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "6px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    color: "var(--ink-muted)",
                    cursor: "pointer",
                    padding: "2px",
                  }}
                >
                  <CloseIcon size={11} />
                </button>
              )}
            </div>

            {/* Close Modal Button */}
            <button
              type="button"
              onClick={onClose}
              title="Close Settings (Esc)"
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "var(--radius-xs)",
                background: "transparent",
                border: "none",
                color: "var(--ink-muted)",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                transition: "background 0.1s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <CloseIcon size={15} />
            </button>
          </div>
        </div>

        {/* Left Sidebar Navigation */}
        <div
          style={{
            background: "var(--bg-sidebar)",
            borderRight: "1px solid var(--border-subtle)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            overflow: "hidden",
          }}
        >
          {/* 10 Root Categories */}
          <nav
            style={{
              padding: "10px 8px",
              display: "flex",
              flexDirection: "column",
              gap: "2px",
              overflowY: "auto",
              flex: 1,
            }}
          >
            {[
              { id: "general", label: "General", icon: <SettingsIcon size={14} /> },
              {
                id: "models",
                label: "Models",
                icon: <SparklesIcon size={14} />,
                isAccordion: true,
                expanded: modelsExpanded,
                setExpanded: setModelsExpanded,
                defaultSubId: "models:main",
                subItems: [
                  { id: "models:main", label: "Main & Reasoning" },
                  { id: "models:fallback", label: "Fallback & Pools" },
                  { id: "models:subagents", label: "Auxiliary & Subagents" },
                ],
              },
              { id: "memory", label: "Memory & Context", icon: <MemoryBrainIcon size={14} /> },
              { id: "workspace", label: "Workspace & Browser", icon: <FolderIcon size={14} /> },
              { id: "permissions", label: "Safety & Permissions", icon: <ShieldIcon size={14} /> },
              { id: "channels", label: "Channels", icon: <RadioIcon size={14} /> },
              { id: "skills", label: "Skills & Tool Keys", icon: <SkillsChipIcon size={14} /> },
              {
                id: "remotes",
                label: "Gateways",
                icon: <ServerIcon size={14} />,
                isAccordion: true,
                expanded: remotesExpanded,
                setExpanded: setRemotesExpanded,
                defaultSubId: "remotes:primary",
                subItems: [
                  { id: "remotes:primary", label: "Primary gateway" },
                  { id: "remotes:saved", label: "Saved nodes" },
                ],
              },
              { id: "automations", label: "Automations", icon: <ClockIcon size={14} /> },
              { id: "about", label: "About", icon: <CoreBlowEmblem size={14} /> },
            ].map((cat) => {
              if (cat.isAccordion) {
                const isCatActive =
                  cat.id === "models"
                    ? activeSection.startsWith("models")
                    : activeSection.startsWith("remotes") || activeSection === "remotes";
                return (
                  <div
                    key={cat.id}
                    style={{ display: "flex", flexDirection: "column", gap: "1px" }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        cat.setExpanded?.((prev: boolean) => !prev);
                        if (!isCatActive) setActiveSection(cat.defaultSubId as SettingsSection);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        height: "34px",
                        padding: "0 10px",
                        borderRadius: "var(--radius-sm)",
                        background: isCatActive ? "var(--bg-chip)" : "transparent",
                        border: isCatActive
                          ? "1px solid var(--border-medium)"
                          : "1px solid transparent",
                        color: isCatActive ? "var(--ink-primary)" : "var(--ink-secondary)",
                        fontSize: "13px",
                        fontWeight: isCatActive ? 600 : 400,
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.12s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span
                          style={{
                            color: isCatActive ? "var(--accent-teal)" : "var(--ink-muted)",
                          }}
                        >
                          {cat.icon}
                        </span>
                        <span>{cat.label}</span>
                      </div>
                      <span
                        style={{ color: "var(--ink-muted)", display: "grid", placeItems: "center" }}
                      >
                        {cat.expanded ? (
                          <ChevronDownIcon size={12} />
                        ) : (
                          <ChevronRightIcon size={12} />
                        )}
                      </span>
                    </button>

                    {cat.expanded && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "1px",
                          paddingLeft: "26px",
                          margin: "2px 0 4px",
                        }}
                      >
                        {cat.subItems?.map((sub) => {
                          const isSubActive =
                            activeSection === sub.id ||
                            (sub.id === "models:main" && activeSection === "models") ||
                            (sub.id === "remotes:primary" && activeSection === "remotes");
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => setActiveSection(sub.id as SettingsSection)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                height: "28px",
                                padding: "0 8px",
                                borderRadius: "4px",
                                background: isSubActive ? "var(--bg-hover)" : "transparent",
                                color: isSubActive ? "var(--accent-teal)" : "var(--ink-muted)",
                                fontSize: "12px",
                                fontWeight: isSubActive ? 600 : 400,
                                border: "none",
                                cursor: "pointer",
                                textAlign: "left",
                                transition: "all 0.1s ease",
                              }}
                            >
                              {sub.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              const isActive = activeSection === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveSection(cat.id as SettingsSection)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    height: "34px",
                    padding: "0 10px",
                    borderRadius: "var(--radius-sm)",
                    background: isActive ? "var(--bg-chip)" : "transparent",
                    border: isActive ? "1px solid var(--border-medium)" : "1px solid transparent",
                    color: isActive ? "var(--ink-primary)" : "var(--ink-secondary)",
                    fontSize: "13px",
                    fontWeight: isActive ? 600 : 400,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.12s ease",
                  }}
                >
                  <span style={{ color: isActive ? "var(--accent-teal)" : "var(--ink-muted)" }}>
                    {cat.icon}
                  </span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer Utility Strip */}
          <div
            style={{
              padding: "8px 12px",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              background: "var(--bg-sidebar)",
            }}
          >
            {utilityStatus && (
              <div
                style={{
                  fontSize: "10.5px",
                  color: "var(--accent-teal)",
                  textAlign: "center",
                  fontWeight: 600,
                  padding: "2px 0",
                }}
              >
                {utilityStatus}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <button
                type="button"
                onClick={handleExportSettings}
                title="Export Settings JSON (Non-secret)"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 8px",
                  borderRadius: "var(--radius-xs)",
                  background: "transparent",
                  border: "none",
                  color: "var(--ink-muted)",
                  fontSize: "11px",
                  cursor: "pointer",
                  transition: "color 0.1s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-muted)")}
              >
                <DownloadIcon size={13} />
                <span>Export</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Import Settings JSON"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 8px",
                  borderRadius: "var(--radius-xs)",
                  background: "transparent",
                  border: "none",
                  color: "var(--ink-muted)",
                  fontSize: "11px",
                  cursor: "pointer",
                  transition: "color 0.1s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-muted)")}
              >
                <UploadIcon size={13} />
                <span>Import</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: "none" }}
                onChange={handleImportSettings}
              />

              <button
                type="button"
                onClick={handleReloadConfig}
                title="Reload configuration"
                style={{
                  width: "26px",
                  height: "26px",
                  borderRadius: "var(--radius-xs)",
                  background: "transparent",
                  border: "none",
                  color: "var(--ink-muted)",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-muted)")}
              >
                <RefreshIcon size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Content Area */}
        <div style={{ padding: "24px 28px", overflowY: "auto", position: "relative" }}>
          {/* Search Result Overlay Dropdown when Search Query is active */}
          {searchQuery.trim().length > 0 && (
            <div
              style={{
                marginBottom: "24px",
                padding: "12px",
                background: "var(--bg-card)",
                border: "1px solid var(--accent-teal)",
                borderRadius: "var(--radius-sm)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--ink-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "8px",
                }}
              >
                Search Results ({filteredSearchResults.length})
              </div>
              {filteredSearchResults.length === 0 ? (
                <div style={{ fontSize: "12.5px", color: "var(--ink-muted)", padding: "8px 0" }}>
                  No settings matching "{searchQuery}"
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {filteredSearchResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveSection(item.section);
                        if (item.section.startsWith("models")) setModelsExpanded(true);
                        setSearchQuery("");
                      }}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "6px",
                        background: "var(--bg-hover)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        border: "none",
                        textAlign: "left",
                        width: "100%",
                        transition: "background 0.1s ease",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "12.5px",
                            fontWeight: 600,
                            color: "var(--ink-primary)",
                          }}
                        >
                          {item.title}
                        </div>
                        <div style={{ fontSize: "11.5px", color: "var(--ink-muted)" }}>
                          {item.description}
                        </div>
                      </div>
                      <span
                        style={{ fontSize: "10.5px", color: "var(--accent-teal)", fontWeight: 600 }}
                      >
                        {item.section}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 1. GENERAL CATEGORY */}
          {activeSection === "general" && (
            <div>
              <SettingGroup title="APPEARANCE & THEME">
                <SettingRow
                  label="Color Theme"
                  description="Choose between dark Forest-Obsidian or high-contrast crisp Light mode."
                >
                  <div
                    style={{
                      display: "flex",
                      background: "var(--bg-input)",
                      borderRadius: "6px",
                      padding: "2px",
                      border: "1px solid var(--border-medium)",
                    }}
                  >
                    {(["dark", "light"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => onUpdatePreferences({ themeMode: mode })}
                        style={{
                          padding: "4px 12px",
                          fontSize: "12px",
                          fontWeight: preferences.themeMode === mode ? 600 : 400,
                          borderRadius: "4px",
                          border: "none",
                          background:
                            preferences.themeMode === mode ? "var(--bg-card)" : "transparent",
                          color:
                            preferences.themeMode === mode
                              ? "var(--accent-teal)"
                              : "var(--ink-muted)",
                          cursor: "pointer",
                        }}
                      >
                        {mode === "dark" ? "Dark OLED" : "Light"}
                      </button>
                    ))}
                  </div>
                </SettingRow>

                <SettingRow
                  label="Accent Color"
                  description="System-wide highlight color for active pills, links, and indicators."
                >
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    {ACCENT_SWATCHES.map((swatch) => (
                      <button
                        key={swatch.color}
                        type="button"
                        onClick={() => onUpdatePreferences({ accentColor: swatch.color })}
                        title={swatch.name}
                        style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          background: swatch.color,
                          border:
                            preferences.accentColor === swatch.color
                              ? "2px solid #FFFFFF"
                              : "1px solid rgba(0,0,0,0.2)",
                          boxShadow:
                            preferences.accentColor === swatch.color
                              ? `0 0 0 2px ${swatch.color}`
                              : "none",
                          cursor: "pointer",
                          padding: 0,
                        }}
                      />
                    ))}
                  </div>
                </SettingRow>

                <SettingRow
                  label="Workspace Layout Mode"
                  description="Pro mode docks the inspector drawer permanently; Basic mode uses full canvas."
                >
                  <div
                    style={{
                      display: "flex",
                      background: "var(--bg-input)",
                      borderRadius: "6px",
                      padding: "2px",
                      border: "1px solid var(--border-medium)",
                    }}
                  >
                    {(["basic", "pro"] as const).map((layout) => (
                      <button
                        key={layout}
                        type="button"
                        onClick={() =>
                          onUpdatePreferences({
                            layoutMode: layout,
                            inspectorOpen: layout === "pro",
                          })
                        }
                        style={{
                          padding: "4px 12px",
                          fontSize: "12px",
                          fontWeight: preferences.layoutMode === layout ? 600 : 400,
                          borderRadius: "4px",
                          border: "none",
                          background:
                            preferences.layoutMode === layout ? "var(--bg-card)" : "transparent",
                          color:
                            preferences.layoutMode === layout
                              ? "var(--accent-teal)"
                              : "var(--ink-muted)",
                          cursor: "pointer",
                        }}
                      >
                        {layout === "basic" ? "Basic" : "Pro"}
                      </button>
                    ))}
                  </div>
                </SettingRow>
              </SettingGroup>

              <SettingGroup title="TERMINAL & NOTIFICATIONS">
                <SettingRow
                  label="Terminal Font Family"
                  description="Monospace typeface used in the integrated session terminal."
                >
                  <select
                    value={preferences.terminalFontFamily || "JetBrains Mono"}
                    onChange={(e) => onUpdatePreferences({ terminalFontFamily: e.target.value })}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "6px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-medium)",
                      color: "var(--ink-primary)",
                      fontSize: "12px",
                      outline: "none",
                    }}
                  >
                    <option value="JetBrains Mono">JetBrains Mono</option>
                    <option value="SF Mono">SF Mono</option>
                    <option value="Fira Code">Fira Code</option>
                    <option value="Menlo">Menlo</option>
                  </select>
                </SettingRow>

                <SettingRow
                  label="Terminal Font Size"
                  description="Pixel font size for shell outputs."
                >
                  <input
                    type="number"
                    min={11}
                    max={18}
                    value={preferences.terminalFontSize ?? 13}
                    onChange={(e) =>
                      onUpdatePreferences({ terminalFontSize: Number(e.target.value) || 13 })
                    }
                    style={{
                      width: "60px",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-medium)",
                      color: "var(--ink-primary)",
                      fontSize: "12px",
                      textAlign: "right",
                    }}
                  />
                </SettingRow>

                <SettingRow
                  label="Desktop Notifications"
                  description="Show native OS notifications when long-running tool tasks finish."
                >
                  <ToggleSwitch
                    checked={preferences.desktopNotifications ?? true}
                    onChange={(checked) => onUpdatePreferences({ desktopNotifications: checked })}
                    ariaLabel="Toggle desktop notifications"
                  />
                </SettingRow>
              </SettingGroup>

              <SettingGroup title="SOFTWARE UPDATES">
                <SettingRow
                  label="Automatically Check for Updates"
                  description="Check GitHub Releases in the background on launch."
                >
                  <ToggleSwitch
                    checked={preferences.autoCheckUpdates ?? true}
                    onChange={(checked) => {
                      onUpdatePreferences({ autoCheckUpdates: checked });
                      window.coreblowDesktop?.updater?.setAutoCheck(checked).catch(() => {});
                    }}
                    ariaLabel="Toggle automatic update checks"
                  />
                </SettingRow>

                <SettingRow
                  label="Release Channel Check"
                  description={describeUpdateStatus(updateStatus)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {updateStatus?.phase === "available" && (
                      <button
                        type="button"
                        onClick={() => onDownloadUpdate?.()}
                        style={{
                          padding: "5px 12px",
                          borderRadius: "6px",
                          border: "none",
                          background: "#E95420",
                          color: "#FFFFFF",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Download v{updateStatus.availableVersion}
                      </button>
                    )}
                    {updateStatus?.phase === "downloaded" && (
                      <button
                        type="button"
                        onClick={() => onInstallUpdate?.()}
                        style={{
                          padding: "5px 12px",
                          borderRadius: "6px",
                          border: "none",
                          background: "#E95420",
                          color: "#FFFFFF",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Restart to Install
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (onCheckForUpdates) {
                          onCheckForUpdates();
                        } else {
                          window.coreblowDesktop?.updater?.checkForUpdates().catch(() => {});
                        }
                      }}
                      disabled={
                        updateStatus?.phase === "checking" || updateStatus?.phase === "downloading"
                      }
                      style={{
                        padding: "5px 12px",
                        borderRadius: "6px",
                        background: "var(--bg-input)",
                        border: "1px solid var(--border-medium)",
                        color: "var(--ink-primary)",
                        fontSize: "12px",
                        fontWeight: 500,
                        cursor:
                          updateStatus?.phase === "checking" ||
                          updateStatus?.phase === "downloading"
                            ? "wait"
                            : "pointer",
                      }}
                    >
                      {updateStatus?.phase === "checking" ? "Checking..." : "Check for Updates"}
                    </button>
                  </div>
                </SettingRow>
              </SettingGroup>

              <SettingGroup title="KEYBOARD SHORTCUTS">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                    fontSize: "12px",
                  }}
                >
                  {[
                    { key: "⌘ ,", desc: "Open Settings" },
                    { key: "⌘ K", desc: "Command Palette" },
                    { key: "⌘ P", desc: "Workspace Files" },
                    { key: "Ctrl `", desc: "New Terminal" },
                    { key: "⌘ T", desc: "Browser Preview" },
                    { key: "⌘ N", desc: "New Session" },
                    { key: "⌘ I", desc: "Toggle Right Panel" },
                    { key: "Esc", desc: "Dismiss / Stop" },
                  ].map((sc) => (
                    <div
                      key={sc.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 10px",
                        background: "var(--bg-input)",
                        borderRadius: "6px",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <span style={{ color: "var(--ink-secondary)" }}>{sc.desc}</span>
                      <kbd
                        style={{
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "var(--bg-card)",
                          border: "1px solid var(--border-medium)",
                          fontFamily: "var(--font-mono)",
                          fontSize: "11px",
                          color: "var(--accent-teal)",
                        }}
                      >
                        {sc.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </SettingGroup>

              <SettingGroup title="ONBOARDING & SETUP">
                <SettingRow
                  label="First-Run Setup Wizard"
                  description="Rerun the guided walkthrough to configure your identity, initial models, and keys."
                >
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onRunSetupWizard?.();
                    }}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "6px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-medium)",
                      color: "var(--ink-primary)",
                      fontSize: "12px",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Run Setup Wizard
                  </button>
                </SettingRow>
              </SettingGroup>
            </div>
          )}

          {/* 2. MODELS CATEGORY: Accordion Subviews */}
          {activeSection.startsWith("models") && (
            <div>
              {/* Tab Selector pills inside Models */}
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  marginBottom: "20px",
                  borderBottom: "1px solid var(--border-subtle)",
                  paddingBottom: "12px",
                }}
              >
                {[
                  { id: "models:main", label: "Main & Reasoning" },
                  { id: "models:fallback", label: "Fallback & Pools" },
                  { id: "models:subagents", label: "Auxiliary & Subagents" },
                ].map((tab) => {
                  const isCur =
                    activeSection === tab.id ||
                    (tab.id === "models:main" && activeSection === "models");
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveSection(tab.id as SettingsSection)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "6px",
                        background: isCur ? "var(--bg-chip)" : "transparent",
                        border: isCur ? "1px solid var(--border-medium)" : "1px solid transparent",
                        color: isCur ? "var(--accent-teal)" : "var(--ink-secondary)",
                        fontSize: "12.5px",
                        fontWeight: isCur ? 600 : 400,
                        cursor: "pointer",
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Sub-view: Main & Reasoning */}
              {currentModelsSubView === "main" && (
                <div>
                  <SettingGroup title="PRIMARY MODEL CONFIGURATION">
                    <SettingRow
                      label="Active Model Tier"
                      description="Default model speed and intelligence profile applied to new conversations."
                    >
                      <select
                        value={preferences.modelTier}
                        onChange={(e) => onUpdatePreferences({ modelTier: e.target.value as any })}
                        style={{
                          padding: "5px 10px",
                          borderRadius: "6px",
                          background: "var(--bg-input)",
                          border: "1px solid var(--border-medium)",
                          color: "var(--ink-primary)",
                          fontSize: "12px",
                        }}
                      >
                        <option value="High Reasoning">High Reasoning (Balanced Default)</option>
                        <option value="Speed First">Speed First (Low Latency)</option>
                        <option value="Max Intelligence">
                          Max Intelligence (Complex Engineering)
                        </option>
                      </select>
                    </SettingRow>

                    <SettingRow
                      label="Default Reasoning Effort"
                      description="Thinking token budget allocated for deep reasoning tasks."
                    >
                      <select
                        value={preferences.defaultReasoningEffort || "Medium"}
                        onChange={(e) =>
                          onUpdatePreferences({ defaultReasoningEffort: e.target.value as any })
                        }
                        style={{
                          padding: "5px 10px",
                          borderRadius: "6px",
                          background: "var(--bg-input)",
                          border: "1px solid var(--border-medium)",
                          color: "var(--ink-primary)",
                          fontSize: "12px",
                        }}
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium (Recommended)</option>
                        <option value="High">High</option>
                        <option value="Max">Max</option>
                      </select>
                    </SettingRow>

                    <SettingRow
                      label="Main Context Window Override"
                      description="Overrides detected context window tokens (0 = use model detected value)."
                    >
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={preferences.mainContextWindowOverride ?? 0}
                        onChange={(e) =>
                          onUpdatePreferences({
                            mainContextWindowOverride: Number(e.target.value) || 0,
                          })
                        }
                        style={{
                          width: "90px",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          background: "var(--bg-input)",
                          border: "1px solid var(--border-medium)",
                          color: "var(--ink-primary)",
                          fontSize: "12px",
                          textAlign: "right",
                        }}
                      />
                    </SettingRow>
                  </SettingGroup>

                  <SettingGroup title="LIVE USAGE TELEMETRY">
                    {(() => {
                      const todayKey = new Date().toISOString().slice(0, 10);
                      const daily = poolData?.telemetry?.daily?.[todayKey] ?? {
                        requests: 0,
                        totalTokens: 0,
                        failovers: 0,
                        estimatedCostUsd: 0,
                      };
                      const stats = [
                        { label: "Today's Requests", val: String(daily.requests) },
                        {
                          label: "Tokens Processed",
                          val:
                            daily.totalTokens > 1000
                              ? `${(daily.totalTokens / 1000).toFixed(1)}k`
                              : String(daily.totalTokens),
                        },
                        { label: "Failovers", val: String(daily.failovers) },
                        { label: "Est. Cost", val: `$${daily.estimatedCostUsd.toFixed(4)}` },
                      ];
                      return (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(4, 1fr)",
                            gap: "10px",
                            marginTop: "8px",
                          }}
                        >
                          {stats.map((stat) => (
                            <div
                              key={stat.label}
                              style={{
                                padding: "10px",
                                borderRadius: "8px",
                                background: "var(--bg-input)",
                                border: "1px solid var(--border-subtle)",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "11px",
                                  color: "var(--ink-muted)",
                                  marginBottom: "4px",
                                }}
                              >
                                {stat.label}
                              </div>
                              <div
                                style={{
                                  fontSize: "16px",
                                  fontWeight: 700,
                                  color: "var(--accent-teal)",
                                }}
                              >
                                {stat.val}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </SettingGroup>
                </div>
              )}

              {/* Sub-view: Fallback & Pools */}
              {currentModelsSubView === "fallback" && (
                <div>
                  <SettingGroup title="DAYBREAK PROVIDER FALLBACK CHAIN">
                    <p
                      style={{
                        fontSize: "12px",
                        color: "var(--ink-secondary)",
                        marginBottom: "12px",
                      }}
                    >
                      When a provider experiences rate limits or network degradation, CoreBlow
                      automatically fails over along this chain.
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {(poolData?.fallbackChain || ["anthropic", "openai", "gemini", "groq"]).map(
                        (provider, idx, arr) => (
                          <div
                            key={provider}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "8px 12px",
                              background: "var(--bg-input)",
                              borderRadius: "6px",
                              border: "1px solid var(--border-subtle)",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "var(--accent-teal)",
                                  fontWeight: 700,
                                }}
                              >
                                #{idx + 1}
                              </span>
                              <span
                                style={{
                                  fontSize: "13px",
                                  fontWeight: 500,
                                  color: "var(--ink-primary)",
                                  textTransform: "capitalize",
                                }}
                              >
                                {provider}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: "4px" }}>
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveFallback(idx, -1)}
                                style={{
                                  padding: "2px 8px",
                                  fontSize: "11px",
                                  background: "var(--bg-card)",
                                  border: "1px solid var(--border-medium)",
                                  borderRadius: "4px",
                                  color: idx === 0 ? "var(--ink-muted)" : "var(--ink-primary)",
                                  cursor: idx === 0 ? "default" : "pointer",
                                }}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                disabled={idx === arr.length - 1}
                                onClick={() => handleMoveFallback(idx, 1)}
                                style={{
                                  padding: "2px 8px",
                                  fontSize: "11px",
                                  background: "var(--bg-card)",
                                  border: "1px solid var(--border-medium)",
                                  borderRadius: "4px",
                                  color:
                                    idx === arr.length - 1
                                      ? "var(--ink-muted)"
                                      : "var(--ink-primary)",
                                  cursor: idx === arr.length - 1 ? "default" : "pointer",
                                }}
                              >
                                ↓
                              </button>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </SettingGroup>

                  <SettingGroup title="MULTI-KEY CREDENTIAL POOLS">
                    <form
                      onSubmit={handleAddPoolKey}
                      style={{
                        display: "flex",
                        gap: "8px",
                        marginBottom: "12px",
                        alignItems: "center",
                      }}
                    >
                      <select
                        value={newKeyProvider}
                        onChange={(e) => setNewKeyProvider(e.target.value)}
                        style={{
                          padding: "5px 10px",
                          borderRadius: "6px",
                          background: "var(--bg-input)",
                          border: "1px solid var(--border-medium)",
                          color: "var(--ink-primary)",
                          fontSize: "12px",
                        }}
                      >
                        <option value="anthropic">Anthropic</option>
                        <option value="openai">OpenAI</option>
                        <option value="gemini">Google Gemini</option>
                        <option value="groq">Groq</option>
                      </select>
                      <input
                        type="password"
                        placeholder="API Key..."
                        value={newKeyValue}
                        onChange={(e) => setNewKeyValue(e.target.value)}
                        style={{
                          flex: 1,
                          padding: "5px 10px",
                          borderRadius: "6px",
                          background: "var(--bg-input)",
                          border: "1px solid var(--border-medium)",
                          color: "var(--ink-primary)",
                          fontSize: "12px",
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Label (optional)"
                        value={newKeyLabel}
                        onChange={(e) => setNewKeyLabel(e.target.value)}
                        style={{
                          width: "120px",
                          padding: "5px 10px",
                          borderRadius: "6px",
                          background: "var(--bg-input)",
                          border: "1px solid var(--border-medium)",
                          color: "var(--ink-primary)",
                          fontSize: "12px",
                        }}
                      />
                      <button
                        type="submit"
                        style={{
                          padding: "5px 12px",
                          borderRadius: "6px",
                          background: "var(--accent-teal)",
                          border: "none",
                          color: "#000000",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Add Key
                      </button>
                    </form>

                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {!poolData?.pools || Object.keys(poolData.pools).length === 0 ? (
                        <div
                          style={{
                            fontSize: "11px",
                            color: "var(--ink-muted)",
                            fontStyle: "italic",
                          }}
                        >
                          No pooled keys added yet. Add multiple keys per provider for automatic
                          failover on 429 rate limits.
                        </div>
                      ) : (
                        Object.entries(poolData.pools).flatMap(([prov, keys]) =>
                          keys.map((k) => (
                            <div
                              key={k.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "6px 10px",
                                background: "var(--bg-input)",
                                borderRadius: "6px",
                                border: "1px solid var(--border-subtle)",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    color: "var(--ink-primary)",
                                  }}
                                >
                                  [{prov}]
                                </span>
                                <span style={{ fontSize: "11px", color: "var(--ink-secondary)" }}>
                                  {k.label || k.providerId}
                                </span>
                                <code style={{ fontSize: "10px", color: "var(--ink-muted)" }}>
                                  {k.apiKey}
                                </code>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeletePoolKey(k.id)}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "var(--ink-muted)",
                                  cursor: "pointer",
                                  padding: "2px",
                                }}
                              >
                                <TrashIcon size={13} />
                              </button>
                            </div>
                          )),
                        )
                      )}
                    </div>
                  </SettingGroup>

                  <SettingGroup title="DIRECT VAULT OVERRIDES">
                    {[
                      {
                        key: "anthropicApiKey" as const,
                        label: "Anthropic API Key",
                        placeholder: "sk-ant-...",
                      },
                      {
                        key: "openAiApiKey" as const,
                        label: "OpenAI API Key",
                        placeholder: "sk-proj-...",
                      },
                      {
                        key: "geminiApiKey" as const,
                        label: "Google Gemini API Key",
                        placeholder: "AIzaSy...",
                      },
                      { key: "groqApiKey" as const, label: "Groq API Key", placeholder: "gsk_..." },
                    ].map((item) => (
                      <SettingRow key={item.key} label={item.label} badge="Vault Encrypted">
                        <input
                          type="password"
                          value={preferences[item.key] || ""}
                          placeholder={item.placeholder}
                          onChange={(e) => onUpdatePreferences({ [item.key]: e.target.value })}
                          style={{
                            width: "220px",
                            padding: "5px 10px",
                            borderRadius: "6px",
                            background: "var(--bg-input)",
                            border: "1px solid var(--border-medium)",
                            color: "var(--ink-primary)",
                            fontSize: "12px",
                          }}
                        />
                      </SettingRow>
                    ))}
                    <SettingRow label="Local Ollama Endpoint">
                      <input
                        type="text"
                        value={preferences.localOllamaUrl || "http://127.0.0.1:11434"}
                        onChange={(e) => onUpdatePreferences({ localOllamaUrl: e.target.value })}
                        style={{
                          width: "220px",
                          padding: "5px 10px",
                          borderRadius: "6px",
                          background: "var(--bg-input)",
                          border: "1px solid var(--border-medium)",
                          color: "var(--ink-primary)",
                          fontSize: "12px",
                        }}
                      />
                    </SettingRow>
                  </SettingGroup>
                </div>
              )}

              {/* Sub-view: Auxiliary & Subagents */}
              {currentModelsSubView === "subagents" && (
                <div>
                  <SettingGroup title="AUXILIARY MODEL">
                    <SettingRow
                      label="Auxiliary Model"
                      description="Used for non-blocking background tasks like memory summarization and web parsing."
                    >
                      <select
                        value={preferences.auxiliaryModel || "coreblow/fast"}
                        onChange={(e) => onUpdatePreferences({ auxiliaryModel: e.target.value })}
                        style={{
                          padding: "5px 10px",
                          borderRadius: "6px",
                          background: "var(--bg-input)",
                          border: "1px solid var(--border-medium)",
                          color: "var(--ink-primary)",
                          fontSize: "12px",
                        }}
                      >
                        <option value="coreblow/fast">CoreBlow Fast (Default)</option>
                        <option value="coreblow/balanced">CoreBlow Balanced</option>
                      </select>
                    </SettingRow>
                  </SettingGroup>

                  <SettingGroup title="SUBAGENT DELEGATION LIMITS">
                    <SettingRow
                      label="Maximum Subagent Tree Depth"
                      description="Recursion limit preventing subagents from spawning infinite descendants (1–4)."
                    >
                      <input
                        type="number"
                        min={1}
                        max={4}
                        value={preferences.maxSubagentDepth ?? 2}
                        onChange={(e) =>
                          onUpdatePreferences({ maxSubagentDepth: Number(e.target.value) || 2 })
                        }
                        style={{
                          width: "60px",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          background: "var(--bg-input)",
                          border: "1px solid var(--border-medium)",
                          color: "var(--ink-primary)",
                          fontSize: "12px",
                          textAlign: "right",
                        }}
                      />
                    </SettingRow>

                    <SettingRow
                      label="Maximum Parallel Subagents"
                      description="Concurrency ceiling for simultaneous autonomous subagent execution (1–8)."
                    >
                      <input
                        type="number"
                        min={1}
                        max={8}
                        value={preferences.maxParallelSubagents ?? 4}
                        onChange={(e) =>
                          onUpdatePreferences({ maxParallelSubagents: Number(e.target.value) || 4 })
                        }
                        style={{
                          width: "60px",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          background: "var(--bg-input)",
                          border: "1px solid var(--border-medium)",
                          color: "var(--ink-primary)",
                          fontSize: "12px",
                          textAlign: "right",
                        }}
                      />
                    </SettingRow>
                  </SettingGroup>
                </div>
              )}
            </div>
          )}

          {/* 3. MEMORY & CONTEXT CATEGORY */}
          {activeSection === "memory" && (
            <div>
              <SettingGroup title="MEMORY ENGINE & STORAGE">
                <SettingRow
                  label="Memory Backend Engine"
                  description="Choose between lightweight builtin SQLite FTS5 index or QMD semantic vector index."
                >
                  <select
                    value={preferences.memoryBackend || "builtin"}
                    onChange={(e) => onUpdatePreferences({ memoryBackend: e.target.value as any })}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "6px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-medium)",
                      color: "var(--ink-primary)",
                      fontSize: "12px",
                    }}
                  >
                    <option value="builtin">SQLite FTS5 (Local Fast)</option>
                    <option value="qmd">QMD Hybrid Semantic Index</option>
                  </select>
                </SettingRow>

                <SettingRow
                  label="Memory Citations"
                  description="When memory entries inform an answer, show footnotes linking to stored facts."
                >
                  <select
                    value={preferences.memoryCitations || "auto"}
                    onChange={(e) =>
                      onUpdatePreferences({ memoryCitations: e.target.value as any })
                    }
                    style={{
                      padding: "5px 10px",
                      borderRadius: "6px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-medium)",
                      color: "var(--ink-primary)",
                      fontSize: "12px",
                    }}
                  >
                    <option value="auto">Auto (When relevant)</option>
                    <option value="always">Always</option>
                    <option value="off">Off</option>
                  </select>
                </SettingRow>
              </SettingGroup>

              <SettingGroup title="CONTEXT COMPRESSION">
                <SettingRow
                  label="Context Auto-Compression"
                  description="Summarize early conversation history automatically when token usage reaches ceiling."
                >
                  <ToggleSwitch
                    checked={preferences.contextCompressionEnabled ?? true}
                    onChange={(checked) =>
                      onUpdatePreferences({ contextCompressionEnabled: checked })
                    }
                    ariaLabel="Toggle context auto-compression"
                  />
                </SettingRow>

                <SettingRow
                  label="Compression Threshold (%)"
                  description="Percentage of context window capacity that triggers automatic history compaction (50–95%)."
                >
                  <input
                    type="number"
                    min={50}
                    max={95}
                    value={preferences.contextCompressionThresholdPct ?? 80}
                    onChange={(e) =>
                      onUpdatePreferences({
                        contextCompressionThresholdPct: Number(e.target.value) || 80,
                      })
                    }
                    style={{
                      width: "60px",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-medium)",
                      color: "var(--ink-primary)",
                      fontSize: "12px",
                      textAlign: "right",
                    }}
                  />
                </SettingRow>

                <SettingRow
                  label="Protect Last N Messages"
                  description="Number of recent conversation turns preserved verbatim from compression (2–20)."
                >
                  <input
                    type="number"
                    min={2}
                    max={20}
                    value={preferences.protectLastMessages ?? 6}
                    onChange={(e) =>
                      onUpdatePreferences({ protectLastMessages: Number(e.target.value) || 6 })
                    }
                    style={{
                      width: "60px",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-medium)",
                      color: "var(--ink-primary)",
                      fontSize: "12px",
                      textAlign: "right",
                    }}
                  />
                </SettingRow>
              </SettingGroup>

              <SettingGroup title="CURATED MEMORY FILES (MARKDOWN)">
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                    padding: "4px 0",
                  }}
                >
                  <div style={{ fontSize: "11px", color: "var(--ink-muted)", lineHeight: 1.4 }}>
                    Injected as a frozen snapshot at session start. Saved edits apply immediately to
                    new sessions.
                  </div>

                  {[
                    {
                      id: "user" as const,
                      filename: "USER.md",
                      subtitle: "(User Profile)",
                      charLimit: 1375,
                      defaultPath: "~/.coreblow/memory/users/default/USER.md",
                    },
                    {
                      id: "memory" as const,
                      filename: "MEMORY.md",
                      subtitle: "(Agent Notes)",
                      charLimit: 2200,
                      defaultPath: "~/.coreblow/memory/workspaces/default/MEMORY.md",
                    },
                    {
                      id: "constraints" as const,
                      filename: "CONSTRAINTS.md",
                      subtitle: "(Always Follow)",
                      charLimit: 1500,
                      defaultPath: "~/.coreblow/memory/workspaces/default/CONSTRAINTS.md",
                    },
                  ].map((cfg) => {
                    const activeFile = memoryFiles.find((f) => f.id === cfg.id) || {
                      id: cfg.id,
                      filename: cfg.filename,
                      path: cfg.defaultPath,
                      content: "",
                      charCount: 0,
                      charLimit: cfg.charLimit,
                      updatedAt: "",
                    };
                    const draftContent = memoryDrafts[cfg.id] ?? activeFile.content;
                    const charCount = draftContent.length;
                    const charLimit = activeFile.charLimit || cfg.charLimit;
                    const usageRatio = charLimit > 0 ? charCount / charLimit : 0;
                    const progressColor =
                      usageRatio > 1.0
                        ? "#EF4444"
                        : usageRatio > 0.85
                          ? "#F59E0B"
                          : "var(--accent-teal)";
                    const progressWidth = Math.min(100, Math.round(usageRatio * 100));
                    const isUnchanged = draftContent === activeFile.content;
                    const isSaving = savingMemoryFiles[cfg.id] ?? false;
                    const isResetting = resettingMemoryFiles[cfg.id] ?? false;
                    const status = memoryStatusMap[cfg.id];

                    return (
                      <div
                        key={cfg.id}
                        style={{
                          padding: "14px",
                          borderRadius: "10px",
                          background: "var(--bg-card)",
                          border: "1px solid var(--border-subtle)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                        }}
                      >
                        {/* Header row */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: "12px",
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span
                                style={{
                                  fontWeight: 700,
                                  fontSize: "13px",
                                  color: "var(--accent-teal)",
                                  fontFamily: "var(--font-mono, monospace)",
                                }}
                              >
                                {cfg.filename}
                              </span>
                              <span style={{ fontSize: "12px", color: "var(--ink-muted)" }}>
                                {cfg.subtitle}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: "11px",
                                fontFamily: "var(--font-mono, monospace)",
                                color: "var(--ink-muted)",
                                marginTop: "3px",
                                wordBreak: "break-all",
                              }}
                            >
                              {activeFile.path}
                            </div>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-end",
                              gap: "4px",
                              flexShrink: 0,
                            }}
                          >
                            <span
                              style={{
                                fontSize: "11px",
                                fontFamily: "var(--font-mono, monospace)",
                                fontWeight: 600,
                                color:
                                  usageRatio > 1.0
                                    ? "#EF4444"
                                    : usageRatio > 0.85
                                      ? "#F59E0B"
                                      : "var(--ink-secondary)",
                              }}
                            >
                              {charCount} / {charLimit} chars
                            </span>
                            <div
                              style={{
                                width: "140px",
                                height: "4px",
                                borderRadius: "2px",
                                background: "var(--bg-chip)",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${progressWidth}%`,
                                  height: "100%",
                                  background: progressColor,
                                  transition: "width 0.2s ease, background 0.2s ease",
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Monospace Markdown textarea */}
                        <textarea
                          aria-label={`Edit ${cfg.filename}`}
                          value={draftContent}
                          onChange={(e) => {
                            const val = e.target.value;
                            setMemoryDrafts((prev) => ({
                              ...prev,
                              [cfg.id]: val,
                            }));
                          }}
                          placeholder={`Enter markdown content for ${cfg.filename}...`}
                          style={{
                            width: "100%",
                            minHeight: "112px",
                            padding: "8px 10px",
                            borderRadius: "6px",
                            background: "var(--bg-input)",
                            border: "1px solid var(--border-medium)",
                            color: "var(--ink-primary)",
                            fontFamily: "var(--font-mono, monospace)",
                            fontSize: "12px",
                            lineHeight: "1.5",
                            resize: "vertical",
                            outline: "none",
                            boxSizing: "border-box",
                          }}
                        />

                        {/* Footer action row */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: "8px",
                            paddingTop: "2px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <button
                              type="button"
                              onClick={() => handleResetMemoryFile(cfg.id)}
                              disabled={isResetting || loadingMemoryFiles}
                              style={{
                                padding: "4px 10px",
                                borderRadius: "6px",
                                border: "1px solid var(--border-medium)",
                                background: "transparent",
                                color: "var(--ink-secondary)",
                                fontSize: "11px",
                                cursor: "pointer",
                                opacity: isResetting ? 0.6 : 1,
                              }}
                            >
                              {isResetting ? "Reset" : "Reset"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRevertMemoryFile(cfg.id)}
                              disabled={isUnchanged || loadingMemoryFiles}
                              style={{
                                padding: "4px 10px",
                                borderRadius: "6px",
                                border: "1px solid var(--border-medium)",
                                background: "transparent",
                                color: "var(--ink-muted)",
                                fontSize: "11px",
                                cursor: isUnchanged ? "default" : "pointer",
                                opacity: isUnchanged ? 0.4 : 1,
                              }}
                            >
                              Revert
                            </button>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {status && (
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: status.ok ? "var(--accent-teal)" : "#EF4444",
                                  fontWeight: 500,
                                }}
                              >
                                {status.text}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleSaveMemoryFile(cfg.id)}
                              disabled={isUnchanged || isSaving || loadingMemoryFiles}
                              style={{
                                padding: "5px 14px",
                                borderRadius: "6px",
                                border: "none",
                                background: "var(--accent-teal)",
                                color: "#08110F",
                                fontSize: "11px",
                                fontWeight: 600,
                                cursor: isUnchanged || isSaving ? "default" : "pointer",
                                opacity: isUnchanged || isSaving ? 0.5 : 1,
                                transition: "opacity 0.15s ease",
                              }}
                            >
                              {isSaving ? "Saving..." : "Save"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SettingGroup>
            </div>
          )}

          {/* 4. WORKSPACE & BROWSER CATEGORY */}
          {activeSection === "workspace" && (
            <div>
              <SettingGroup title="WORKSPACE & TERMINAL ENVIRONMENT">
                <SettingRow
                  label="Default Working Directory (CWD)"
                  description="Base directory for new sessions and terminal commands (leave blank for default)."
                >
                  <input
                    type="text"
                    placeholder="e.g. ~/Projects"
                    value={preferences.defaultWorkspaceCwd || ""}
                    onChange={(e) => onUpdatePreferences({ defaultWorkspaceCwd: e.target.value })}
                    style={{
                      width: "240px",
                      padding: "5px 10px",
                      borderRadius: "6px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-medium)",
                      color: "var(--ink-primary)",
                      fontSize: "12px",
                    }}
                  />
                </SettingRow>

                <SettingRow
                  label="Persistent Shell Session"
                  description="Keep terminal environment and virtualenv state intact between consecutive tool executions."
                >
                  <ToggleSwitch
                    checked={preferences.persistentShell ?? true}
                    onChange={(checked) => onUpdatePreferences({ persistentShell: checked })}
                    ariaLabel="Toggle persistent shell"
                  />
                </SettingRow>

                <SettingRow
                  label="Repository Scan Exclusions"
                  description="Comma-separated patterns ignored when workspace files are scanned or searched."
                >
                  <input
                    type="text"
                    value={
                      preferences.repoScanExclusions || "node_modules, .git, dist, build, release"
                    }
                    onChange={(e) => onUpdatePreferences({ repoScanExclusions: e.target.value })}
                    style={{
                      width: "240px",
                      padding: "5px 10px",
                      borderRadius: "6px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-medium)",
                      color: "var(--ink-primary)",
                      fontSize: "12px",
                    }}
                  />
                </SettingRow>
              </SettingGroup>

              <SettingGroup title="BROWSER ENGINE">
                <SettingRow
                  label="Browser Mode"
                  description="Choose whether automated browser tools run in background or open a visible window."
                >
                  <select
                    value={preferences.browserMode || "headless"}
                    onChange={(e) => onUpdatePreferences({ browserMode: e.target.value as any })}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "6px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-medium)",
                      color: "var(--ink-primary)",
                      fontSize: "12px",
                    }}
                  >
                    <option value="headless">Headless (Fast, Background)</option>
                    <option value="headed">Headed (Visible Window)</option>
                  </select>
                </SettingRow>

                <SettingRow
                  label="Use Real Browser Profile"
                  description="Mount existing user profile to inherit authenticated sessions and cookies."
                >
                  <ToggleSwitch
                    checked={preferences.browserUseRealProfile ?? false}
                    onChange={(checked) => onUpdatePreferences({ browserUseRealProfile: checked })}
                    ariaLabel="Toggle use real browser profile"
                  />
                </SettingRow>

                <SettingRow
                  label="Private URL SSRF Guard"
                  description="Block browser subagent from navigating to local loopback (127.0.0.1) or LAN IP ranges."
                >
                  <ToggleSwitch
                    checked={preferences.browserPrivateUrlGuard ?? true}
                    onChange={(checked) => onUpdatePreferences({ browserPrivateUrlGuard: checked })}
                    ariaLabel="Toggle SSRF guard"
                  />
                </SettingRow>
              </SettingGroup>
            </div>
          )}

          {/* 5. SAFETY & PERMISSIONS CATEGORY */}
          {activeSection === "permissions" && (
            <div>
              <SettingGroup title="EXECUTION BOUNDARIES">
                <SettingRow
                  label="Default Execution Boundary"
                  description="Baseline execution policy for shell commands, file modifications, and network access."
                >
                  <select
                    value={preferences.permissionMode}
                    onChange={(e) =>
                      onUpdatePreferences({ permissionMode: e.target.value as PermissionMode })
                    }
                    style={{
                      padding: "5px 10px",
                      borderRadius: "6px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-medium)",
                      color: "var(--ink-primary)",
                      fontSize: "12px",
                    }}
                  >
                    <option value="Full access">Full access (Direct Terminal)</option>
                    <option value="Workspace">Workspace (Sandbox constrained)</option>
                    <option value="Guarded">Guarded (Prompt before write)</option>
                    <option value="Read-only">Read-only (Inspect without edit)</option>
                  </select>
                </SettingRow>

                <SettingRow
                  label="Tool Approval Timeout (seconds)"
                  description="Seconds to await user approval before aborting pending tool action (15–300s)."
                >
                  <input
                    type="number"
                    min={15}
                    max={300}
                    value={preferences.approvalTimeoutSec ?? 60}
                    onChange={(e) =>
                      onUpdatePreferences({ approvalTimeoutSec: Number(e.target.value) || 60 })
                    }
                    style={{
                      width: "60px",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-medium)",
                      color: "var(--ink-primary)",
                      fontSize: "12px",
                      textAlign: "right",
                    }}
                  />
                </SettingRow>

                <SettingRow
                  label="Secret Redaction in Outputs"
                  description="Automatically detect and mask API keys, tokens, and passwords in tool stdout."
                >
                  <ToggleSwitch
                    checked={preferences.secretRedactionEnabled ?? true}
                    onChange={(checked) => onUpdatePreferences({ secretRedactionEnabled: checked })}
                    ariaLabel="Toggle secret redaction"
                  />
                </SettingRow>

                <SettingRow
                  label="Checkpoint Snapshot Limit"
                  description="Maximum number of historical rollback snapshots retained on disk."
                >
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={preferences.checkpointSnapshotLimit ?? 20}
                    onChange={(e) =>
                      onUpdatePreferences({ checkpointSnapshotLimit: Number(e.target.value) || 20 })
                    }
                    style={{
                      width: "60px",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-medium)",
                      color: "var(--ink-primary)",
                      fontSize: "12px",
                      textAlign: "right",
                    }}
                  />
                </SettingRow>
              </SettingGroup>

              <SettingGroup title="COMMAND FILTERING">
                <SettingRow
                  label="Command Allowlist"
                  description="Comma-separated commands or prefixes that execute without confirmation."
                >
                  <input
                    type="text"
                    value={preferences.commandAllowlist || "git status, git diff, pnpm test, ls"}
                    onChange={(e) => onUpdatePreferences({ commandAllowlist: e.target.value })}
                    style={{
                      width: "240px",
                      padding: "5px 10px",
                      borderRadius: "6px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-medium)",
                      color: "var(--ink-primary)",
                      fontSize: "12px",
                    }}
                  />
                </SettingRow>

                <SettingRow
                  label="Command Denylist"
                  description="Comma-separated patterns blocked from execution under all circumstances."
                >
                  <input
                    type="text"
                    value={preferences.commandDenylist || "rm -rf /, sudo rm, mkfs"}
                    onChange={(e) => onUpdatePreferences({ commandDenylist: e.target.value })}
                    style={{
                      width: "240px",
                      padding: "5px 10px",
                      borderRadius: "6px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-medium)",
                      color: "var(--ink-primary)",
                      fontSize: "12px",
                    }}
                  />
                </SettingRow>
              </SettingGroup>
            </div>
          )}

          {/* 6. CHANNELS CATEGORY */}
          {activeSection === "channels" && (
            <div>
              <SettingGroup title="MESSAGING CHANNELS">
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {Object.entries(channelsConfig).map(([name, conf]) => (
                    <div
                      key={name}
                      style={{
                        padding: "12px 14px",
                        background: "var(--bg-input)",
                        borderRadius: "8px",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "var(--ink-primary)",
                            }}
                          >
                            {name}
                          </div>
                          <div
                            style={{
                              fontSize: "11px",
                              color: conf.enabled ? "var(--accent-teal)" : "var(--ink-muted)",
                            }}
                          >
                            {conf.enabled ? "Connected / Active" : "Disconnected"}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedChannel(expandedChannel === name ? null : name)
                            }
                            style={{
                              padding: "4px 8px",
                              fontSize: "11px",
                              borderRadius: "4px",
                              background: "var(--bg-card)",
                              border: "1px solid var(--border-medium)",
                              color: "var(--ink-secondary)",
                              cursor: "pointer",
                            }}
                          >
                            Configure
                          </button>
                          <ToggleSwitch
                            checked={conf.enabled}
                            onChange={() => handleToggleChannel(name)}
                            ariaLabel={`Toggle ${name} channel`}
                          />
                        </div>
                      </div>

                      {expandedChannel === name && (
                        <div
                          style={{
                            marginTop: "12px",
                            paddingTop: "12px",
                            borderTop: "1px solid var(--border-subtle)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          <input
                            type="password"
                            placeholder="Channel Access Token..."
                            defaultValue={conf.token || ""}
                            id={`token-${name}`}
                            style={{
                              padding: "5px 10px",
                              borderRadius: "6px",
                              background: "var(--bg-card)",
                              border: "1px solid var(--border-medium)",
                              color: "var(--ink-primary)",
                              fontSize: "12px",
                            }}
                          />
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              type="button"
                              onClick={() => {
                                const input = document.getElementById(
                                  `token-${name}`,
                                ) as HTMLInputElement;
                                handleSaveChannel(name, { token: input?.value });
                              }}
                              style={{
                                padding: "5px 12px",
                                borderRadius: "6px",
                                background: "var(--accent-teal)",
                                border: "none",
                                color: "#000000",
                                fontSize: "11px",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              Save Token
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const input = document.getElementById(
                                  `token-${name}`,
                                ) as HTMLInputElement;
                                handleTestChannel(name.toLowerCase(), input?.value);
                              }}
                              style={{
                                padding: "5px 12px",
                                borderRadius: "6px",
                                background: "var(--bg-card)",
                                border: "1px solid var(--border-medium)",
                                color: "var(--ink-primary)",
                                fontSize: "11px",
                                cursor: "pointer",
                              }}
                            >
                              Test Connection
                            </button>
                          </div>
                          {channelTestStatus[name.toLowerCase()] && (
                            <div
                              style={{
                                fontSize: "11px",
                                color: channelTestStatus[name.toLowerCase()].error
                                  ? "#EF4444"
                                  : "var(--accent-teal)",
                              }}
                            >
                              {channelTestStatus[name.toLowerCase()].testing
                                ? "Testing..."
                                : channelTestStatus[name.toLowerCase()].message ||
                                  channelTestStatus[name.toLowerCase()].error}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </SettingGroup>

              <SettingGroup title="AGENT PAIRING & ACCESS CONTROL">
                <p
                  style={{ fontSize: "12px", color: "var(--ink-secondary)", marginBottom: "12px" }}
                >
                  Manage channel access requests and approved sender identities.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {pairingState.pending.length === 0 && pairingState.approved.length === 0 ? (
                    <div style={{ fontSize: "12px", color: "var(--ink-muted)", padding: "10px 0" }}>
                      No pending pairing requests or channel pairs.
                    </div>
                  ) : (
                    <>
                      {pairingState.pending.map((req) => (
                        <div
                          key={req.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "8px 10px",
                            background: "var(--bg-input)",
                            borderRadius: "6px",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: "12px",
                                fontWeight: 600,
                                color: "var(--ink-primary)",
                              }}
                            >
                              {req.sender} ({req.platform})
                            </div>
                            <div style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
                              Code: {req.code}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleApprovePairing(req.code || req.id)}
                            style={{
                              padding: "4px 10px",
                              borderRadius: "4px",
                              background: "var(--accent-teal)",
                              border: "none",
                              color: "#000000",
                              fontSize: "11px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Approve
                          </button>
                        </div>
                      ))}
                      {pairingState.approved.map((appr) => (
                        <div
                          key={appr.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "8px 10px",
                            background: "var(--bg-input)",
                            borderRadius: "6px",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: "12px",
                                fontWeight: 600,
                                color: "var(--ink-primary)",
                              }}
                            >
                              {appr.sender} ({appr.platform})
                            </div>
                            <div style={{ fontSize: "11px", color: "var(--accent-teal)" }}>
                              Approved identity
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRevokePairing(appr.id)}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "4px",
                              background: "transparent",
                              border: "1px solid var(--border-medium)",
                              color: "var(--ink-muted)",
                              fontSize: "11px",
                              cursor: "pointer",
                            }}
                          >
                            Revoke
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </SettingGroup>
            </div>
          )}

          {/* 7. SKILLS & TOOL KEYS CATEGORY */}
          {activeSection === "skills" && (
            <div>
              <SettingGroup title="EXTERNAL TOOL API KEYS">
                <p
                  style={{ fontSize: "12px", color: "var(--ink-secondary)", marginBottom: "12px" }}
                >
                  Encrypted securely in macOS Keychain Vault and provided to execution tools as
                  needed.
                </p>
                {[
                  {
                    key: "tavilyApiKey" as const,
                    label: "Tavily Web Search API",
                    placeholder: "tvly-...",
                  },
                  {
                    key: "exaApiKey" as const,
                    label: "Exa Neural Search API",
                    placeholder: "exa-...",
                  },
                  { key: "braveApiKey" as const, label: "Brave Search API", placeholder: "BSA..." },
                  {
                    key: "perplexityApiKey" as const,
                    label: "Perplexity API Key",
                    placeholder: "pplx-...",
                  },
                  {
                    key: "e2bApiKey" as const,
                    label: "E2B Cloud Sandbox API",
                    placeholder: "e2b_...",
                  },
                  {
                    key: "modalApiKey" as const,
                    label: "Modal Labs API Token",
                    placeholder: "ak-...",
                  },
                  {
                    key: "daytonaApiKey" as const,
                    label: "Daytona Workspace API",
                    placeholder: "daytona_...",
                  },
                ].map((tool) => (
                  <SettingRow key={tool.key} label={tool.label} badge="OS Vault">
                    <input
                      type="password"
                      value={preferences[tool.key] || ""}
                      placeholder={tool.placeholder}
                      onChange={(e) => onUpdatePreferences({ [tool.key]: e.target.value })}
                      style={{
                        width: "220px",
                        padding: "5px 10px",
                        borderRadius: "6px",
                        background: "var(--bg-input)",
                        border: "1px solid var(--border-medium)",
                        color: "var(--ink-primary)",
                        fontSize: "12px",
                      }}
                    />
                  </SettingRow>
                ))}
              </SettingGroup>

              <SettingGroup title="COREHUB SKILLS & EXTENSIONS">
                {loadingSkills ? (
                  <div style={{ fontSize: "12px", color: "var(--ink-muted)", padding: "12px 0" }}>
                    Loading skills catalog...
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {learnedSkills.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div
                          style={{
                            fontSize: "10.5px",
                            fontWeight: 700,
                            color: "var(--ink-muted)",
                            textTransform: "uppercase",
                          }}
                        >
                          Learned Skills ({learnedSkills.length})
                        </div>
                        {learnedSkills.map((sk) => (
                          <div
                            key={sk.id}
                            style={{
                              padding: "9px 12px",
                              background: "var(--bg-input)",
                              borderRadius: "8px",
                              border: "1px solid var(--border-subtle)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "10px",
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontSize: "12.5px",
                                  fontWeight: 600,
                                  color: "var(--accent-teal)",
                                }}
                              >
                                {sk.name}
                              </div>
                              <div
                                style={{
                                  fontSize: "11px",
                                  color: "var(--ink-muted)",
                                  marginTop: "2px",
                                }}
                              >
                                {sk.description}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                await gatewayClient.toggleLearnedSkill(sk.id, !sk.installed);
                                const [storefront, learned] = await Promise.all([
                                  gatewayClient.getStorefront(),
                                  gatewayClient.getLearnedSkills(),
                                ]);
                                setSkills(storefront);
                                setLearnedSkills(learned);
                              }}
                              style={{
                                padding: "4px 10px",
                                borderRadius: "5px",
                                border: sk.installed
                                  ? "1px solid var(--border-medium)"
                                  : "1px solid var(--accent-teal)",
                                background: sk.installed
                                  ? "var(--bg-card)"
                                  : "var(--accent-teal-subtle)",
                                color: sk.installed ? "var(--ink-secondary)" : "var(--accent-teal)",
                                fontSize: "11px",
                                fontWeight: 600,
                                cursor: "pointer",
                                flexShrink: 0,
                              }}
                            >
                              {sk.installed ? "Disable" : "Enable"}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {skills.length > 0 ? (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        {skills.map((sk) => (
                          <div
                            key={sk.id}
                            style={{
                              padding: "10px 12px",
                              background: "var(--bg-input)",
                              borderRadius: "8px",
                              border: "1px solid var(--border-subtle)",
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                              gap: "8px",
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: "6px",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: "12.5px",
                                    fontWeight: 600,
                                    color: "var(--ink-primary)",
                                  }}
                                >
                                  {sk.name}
                                </span>
                                {sk.version && (
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      color: "var(--ink-muted)",
                                      fontFamily: "var(--font-mono)",
                                    }}
                                  >
                                    v{sk.version}
                                  </span>
                                )}
                              </div>
                              <div
                                style={{
                                  fontSize: "11px",
                                  color: "var(--ink-muted)",
                                  marginTop: "4px",
                                }}
                              >
                                {sk.description}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                if (sk.installed) {
                                  await gatewayClient.uninstallStorefrontItem(sk.id);
                                } else {
                                  await gatewayClient.installStorefrontItem(sk.id);
                                }
                                const [storefront, learned] = await Promise.all([
                                  gatewayClient.getStorefront(),
                                  gatewayClient.getLearnedSkills(),
                                ]);
                                setSkills(storefront);
                                setLearnedSkills(learned);
                              }}
                              style={{
                                alignSelf: "flex-start",
                                padding: "4px 10px",
                                borderRadius: "5px",
                                border: sk.installed ? "1px solid var(--border-medium)" : "none",
                                background: sk.installed ? "var(--bg-card)" : "var(--accent-teal)",
                                color: sk.installed ? "var(--ink-secondary)" : "#08110F",
                                fontSize: "11px",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              {sk.installed ? "Uninstall" : "Install"}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        style={{ fontSize: "12px", color: "var(--ink-muted)", padding: "8px 0" }}
                      >
                        Connected to Gateway skill registry.
                      </div>
                    )}
                  </div>
                )}
              </SettingGroup>

              <SettingGroup title="MCP SERVERS (MODEL CONTEXT PROTOCOL)">
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {mcpServers.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {mcpServers.map((s) => (
                        <div
                          key={s.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "8px 12px",
                            background: "var(--bg-input)",
                            borderRadius: "6px",
                            border: "1px solid var(--border-subtle)",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: "12.5px",
                                fontWeight: 600,
                                color: "var(--ink-primary)",
                              }}
                            >
                              {s.name}
                            </div>
                            <div style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
                              {s.description || s.command || s.url}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            <button
                              type="button"
                              onClick={() => handleProbeMcp(s.id)}
                              style={{
                                padding: "4px 8px",
                                fontSize: "11px",
                                background: "var(--bg-card)",
                                border: "1px solid var(--border-medium)",
                                borderRadius: "4px",
                                color: "var(--ink-primary)",
                                cursor: "pointer",
                              }}
                            >
                              {mcpProbeStatus[s.id]?.status === "probing" ? "Probing..." : "Probe"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMcp(s.id)}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--ink-muted)",
                                cursor: "pointer",
                              }}
                            >
                              <TrashIcon size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {mcpCatalog.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div
                        style={{
                          fontSize: "10.5px",
                          fontWeight: 700,
                          color: "var(--accent-teal)",
                          textTransform: "uppercase",
                        }}
                      >
                        Curated CoreBlow MCP Catalog
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        {mcpCatalog.map((item) => {
                          const isInstalled = mcpServers.some((s) => s.id === item.id);
                          return (
                            <div
                              key={item.id}
                              style={{
                                background: "var(--bg-input)",
                                padding: "10px 12px",
                                borderRadius: "8px",
                                border: "1px solid var(--border-subtle)",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                                gap: "8px",
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    fontWeight: 600,
                                    fontSize: "12px",
                                    color: "var(--ink-primary)",
                                  }}
                                >
                                  {item.name}
                                </div>
                                <div
                                  style={{
                                    fontSize: "11px",
                                    color: "var(--ink-muted)",
                                    marginTop: "3px",
                                  }}
                                >
                                  {item.description}
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={isInstalled}
                                onClick={() => handleInstallMcp(item.id)}
                                style={{
                                  alignSelf: "flex-start",
                                  padding: "4px 10px",
                                  borderRadius: "5px",
                                  border: isInstalled ? "1px solid var(--border-subtle)" : "none",
                                  background: isInstalled ? "var(--bg-card)" : "var(--accent-teal)",
                                  color: isInstalled ? "var(--ink-muted)" : "#08110F",
                                  fontSize: "10.5px",
                                  fontWeight: 600,
                                  cursor: isInstalled ? "default" : "pointer",
                                }}
                              >
                                {isInstalled ? "Installed" : "1-Click Install"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </SettingGroup>
            </div>
          )}

          {/* 8. GATEWAYS & REMOTES CATEGORY */}
          {(activeSection === "remotes:primary" || activeSection === "remotes") && (
            <div>
              <SettingGroup title="PRIMARY GATEWAY CONNECTION">
                <p
                  style={{ fontSize: "12px", color: "var(--ink-secondary)", marginBottom: "14px" }}
                >
                  Configure where CoreBlow Studio directs its reasoning sessions, tools, and storage
                  operations.
                </p>

                {/* 3-card Connection Mode grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "12px",
                    marginBottom: "16px",
                  }}
                >
                  {[
                    {
                      mode: "local" as const,
                      title: "Local gateway",
                      desc: "Start a private CoreBlow daemon on localhost (:18789). Default offline-first mode.",
                    },
                    {
                      mode: "remote" as const,
                      title: "Remote gateway",
                      desc: "Connect this desktop shell to a 24/7 CoreBlow VPS, Tailscale, or Docker node.",
                    },
                    {
                      mode: "ssh" as const,
                      title: "Connect via SSH",
                      desc: "Tunnel securely over key-based SSH to a remote host without exposing public ports.",
                    },
                  ].map((card) => {
                    const isSelected = connectionMode === card.mode;
                    return (
                      <button
                        key={card.mode}
                        type="button"
                        onClick={() => {
                          setConnectionMode(card.mode);
                          onUpdatePreferences({ connectionMode: card.mode });
                        }}
                        style={{
                          padding: "14px",
                          borderRadius: "8px",
                          background: isSelected ? "rgba(45, 212, 191, 0.08)" : "var(--bg-input)",
                          border: isSelected
                            ? "1px solid var(--accent-teal)"
                            : "1px solid var(--border-subtle)",
                          textAlign: "left",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            width: "100%",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "var(--ink-primary)",
                            }}
                          >
                            {card.title}
                          </span>
                          {isSelected && (
                            <span
                              style={{
                                color: "var(--accent-teal)",
                                display: "flex",
                                alignItems: "center",
                              }}
                            >
                              <CheckIcon size={14} />
                            </span>
                          )}
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "11.5px",
                            color: "var(--ink-muted)",
                            lineHeight: 1.45,
                          }}
                        >
                          {card.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Contextual configuration strip */}
                {connectionMode === "remote" && (
                  <div
                    style={{
                      padding: "14px",
                      borderRadius: "8px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-subtle)",
                      marginBottom: "16px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "10px",
                      }}
                    >
                      <span
                        style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-primary)" }}
                      >
                        Select Remote Gateway Node
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveSection("remotes:saved")}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--accent-teal)",
                          fontSize: "12px",
                          cursor: "pointer",
                          padding: 0,
                          fontWeight: 500,
                        }}
                      >
                        Manage saved nodes &rarr;
                      </button>
                    </div>
                    <select
                      value={selectedRemoteNodeId}
                      onChange={(e) => {
                        setSelectedRemoteNodeId(e.target.value);
                        onUpdatePreferences({ activeRemoteNodeId: e.target.value });
                      }}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-medium)",
                        color: "var(--ink-primary)",
                        fontSize: "12px",
                      }}
                    >
                      <option value="local">Default Local Daemon (127.0.0.1:18789)</option>
                      {remoteNodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name} &mdash; {n.url} ({n.kind})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {connectionMode === "ssh" && (
                  <div
                    style={{
                      padding: "14px",
                      borderRadius: "8px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-subtle)",
                      marginBottom: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-primary)" }}>
                      SSH Tunnel Parameters
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: "11px",
                            color: "var(--ink-muted)",
                            marginBottom: "4px",
                          }}
                        >
                          SSH Host
                        </label>
                        <input
                          type="text"
                          placeholder="gateway.internal.net or 100.x.y.z"
                          value={sshHost}
                          onChange={(e) => setSshHost(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "5px 10px",
                            borderRadius: "6px",
                            background: "var(--bg-card)",
                            border: "1px solid var(--border-medium)",
                            color: "var(--ink-primary)",
                            fontSize: "12px",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: "11px",
                            color: "var(--ink-muted)",
                            marginBottom: "4px",
                          }}
                        >
                          SSH Username
                        </label>
                        <input
                          type="text"
                          placeholder="coreblow or root"
                          value={sshUser}
                          onChange={(e) => setSshUser(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "5px 10px",
                            borderRadius: "6px",
                            background: "var(--bg-card)",
                            border: "1px solid var(--border-medium)",
                            color: "var(--ink-primary)",
                            fontSize: "12px",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: "11px",
                            color: "var(--ink-muted)",
                            marginBottom: "4px",
                          }}
                        >
                          SSH Port
                        </label>
                        <input
                          type="number"
                          value={sshPort}
                          onChange={(e) => setSshPort(Number(e.target.value) || 22)}
                          style={{
                            width: "100%",
                            padding: "5px 10px",
                            borderRadius: "6px",
                            background: "var(--bg-card)",
                            border: "1px solid var(--border-medium)",
                            color: "var(--ink-primary)",
                            fontSize: "12px",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: "11px",
                            color: "var(--ink-muted)",
                            marginBottom: "4px",
                          }}
                        >
                          Remote Gateway Port
                        </label>
                        <input
                          type="number"
                          value={sshRemotePort}
                          onChange={(e) => setSshRemotePort(Number(e.target.value) || 18789)}
                          style={{
                            width: "100%",
                            padding: "5px 10px",
                            borderRadius: "6px",
                            background: "var(--bg-card)",
                            border: "1px solid var(--border-medium)",
                            color: "var(--ink-primary)",
                            fontSize: "12px",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "11px",
                          color: "var(--ink-muted)",
                          marginBottom: "4px",
                        }}
                      >
                        Identity Key Path
                      </label>
                      <input
                        type="text"
                        placeholder="~/.ssh/id_ed25519"
                        value={sshKeyPath}
                        onChange={(e) => setSshKeyPath(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "5px 10px",
                          borderRadius: "6px",
                          background: "var(--bg-card)",
                          border: "1px solid var(--border-medium)",
                          color: "var(--ink-primary)",
                          fontSize: "12px",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                    <div style={{ marginTop: "4px" }}>
                      <div
                        style={{ fontSize: "11px", color: "var(--ink-muted)", marginBottom: "4px" }}
                      >
                        Tunnel Command Preview
                      </div>
                      <code
                        style={{
                          display: "block",
                          padding: "8px 10px",
                          borderRadius: "6px",
                          background: "var(--bg-card)",
                          border: "1px solid var(--border-subtle)",
                          color: "var(--accent-teal)",
                          fontSize: "11px",
                          fontFamily: "var(--font-mono, monospace)",
                          wordBreak: "break-all",
                        }}
                      >
                        ssh -N -L 18789:127.0.0.1:{sshRemotePort || 18789} {sshUser || "user"}@
                        {sshHost || "host"} -p {sshPort || 22}
                      </code>
                    </div>
                  </div>
                )}

                {/* Right-aligned action bar below cards */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "20px",
                    gap: "10px",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    {reconnectStatus && (
                      <span
                        style={{
                          fontSize: "11.5px",
                          color: reconnectStatus.startsWith("✓")
                            ? "var(--accent-teal)"
                            : reconnectStatus.startsWith("✗")
                              ? "#ef4444"
                              : "var(--ink-muted)",
                        }}
                      >
                        {reconnectStatus}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdatePreferences({
                          connectionMode,
                          activeRemoteNodeId: selectedRemoteNodeId,
                          sshTunnelHost: sshHost,
                          sshTunnelUser: sshUser,
                          sshTunnelPort: sshPort,
                          sshTunnelRemotePort: sshRemotePort,
                          sshTunnelIdentityFile: sshKeyPath,
                        });
                        setReconnectStatus("✓ Connection configuration saved for next startup.");
                      }}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-medium)",
                        color: "var(--ink-primary)",
                        fontSize: "12px",
                        cursor: "pointer",
                        fontWeight: 500,
                      }}
                    >
                      Save for next restart
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        onUpdatePreferences({
                          connectionMode,
                          activeRemoteNodeId: selectedRemoteNodeId,
                          sshTunnelHost: sshHost,
                          sshTunnelUser: sshUser,
                          sshTunnelPort: sshPort,
                          sshTunnelRemotePort: sshRemotePort,
                          sshTunnelIdentityFile: sshKeyPath,
                        });
                        setReconnectStatus("Reconnecting to gateway...");
                        try {
                          if (window.coreblowDesktop?.gateway?.ensure) {
                            await window.coreblowDesktop.gateway.ensure();
                          }
                          const healthy = await gatewayClient.health();
                          if (healthy) {
                            setReconnectStatus("✓ Connected successfully to gateway.");
                          } else {
                            setReconnectStatus("✗ Gateway responded with error or offline.");
                          }
                        } catch (err: any) {
                          setReconnectStatus(
                            `✗ Reconnect failed: ${err?.message || "unreachable"}`,
                          );
                        }
                      }}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "6px",
                        background: "var(--accent-teal)",
                        border: "none",
                        color: "#000000",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Save and reconnect
                    </button>
                  </div>
                </div>
              </SettingGroup>

              {/* Security & Diagnostics Settings */}
              <SettingGroup title="SECURITY & DIAGNOSTICS">
                <SettingRow
                  label="Encrypt saved secrets with the OS keychain"
                  description="Encrypt API keys, tokens, and credentials using macOS Keychain / OS Vault (enc:v1:)."
                >
                  <ToggleSwitch
                    checked={preferences.encryptSecretsWithKeychain ?? true}
                    onChange={(checked) =>
                      onUpdatePreferences({ encryptSecretsWithKeychain: checked })
                    }
                  />
                </SettingRow>

                <SettingRow
                  label="Diagnostics"
                  description="Reveal desktop logs in your file manager — helpful when troubleshooting startup or daemon issues."
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {diagnosticsStatus && (
                      <span style={{ fontSize: "11px", color: "var(--accent-teal)" }}>
                        {diagnosticsStatus}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        if (window.coreblowDesktop?.diagnostics?.openLogs) {
                          const res = await window.coreblowDesktop.diagnostics.openLogs();
                          if (res.ok) {
                            setDiagnosticsStatus(`Opened ${res.path}`);
                          } else {
                            setDiagnosticsStatus(res.error || "Failed to open logs");
                          }
                        } else {
                          setDiagnosticsStatus(
                            "Desktop log viewer available in desktop environment.",
                          );
                        }
                      }}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "6px",
                        background: "var(--bg-input)",
                        border: "1px solid var(--border-medium)",
                        color: "var(--ink-primary)",
                        fontSize: "12px",
                        cursor: "pointer",
                        fontWeight: 500,
                      }}
                    >
                      Open logs
                    </button>
                  </div>
                </SettingRow>
              </SettingGroup>
            </div>
          )}

          {/* 8B. SAVED NODES SUB-VIEW */}
          {activeSection === "remotes:saved" && (
            <div>
              <SettingGroup title="ALWAYS-ON REMOTE NODES">
                <p
                  style={{ fontSize: "12px", color: "var(--ink-secondary)", marginBottom: "12px" }}
                >
                  Connect to remote 24/7 CoreBlow nodes across VPS, Tailscale, or Docker machines.
                </p>
                {nodeActionStatus && (
                  <div
                    style={{
                      padding: "6px 10px",
                      borderRadius: "6px",
                      background: "var(--accent-teal-subtle)",
                      border: "1px solid var(--accent-teal-glow)",
                      fontSize: "11.5px",
                      color: "var(--accent-teal)",
                      marginBottom: "10px",
                    }}
                  >
                    {nodeActionStatus}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    marginBottom: "20px",
                  }}
                >
                  {remoteNodes.map((node) => (
                    <div
                      key={node.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        background: "var(--bg-input)",
                        borderRadius: "8px",
                        border: "1px solid var(--border-subtle)",
                        gap: "10px",
                      }}
                    >
                      <div>
                        <div
                          style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-primary)" }}
                        >
                          {node.name}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
                          {node.url} ({node.kind})
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={async () => {
                            setNodeActionStatus(`Probing ${node.name}...`);
                            const p = await gatewayClient.probeNode(node.id);
                            setNodeActionStatus(
                              p.healthy
                                ? `✓ ${node.name} Online (${p.latencyMs}ms)`
                                : `✗ ${node.name} Offline: ${p.error || "unreachable"}`,
                            );
                            await fetchNodes();
                          }}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            background: "var(--bg-card)",
                            border: "1px solid var(--border-medium)",
                            color: "var(--ink-primary)",
                            fontSize: "11px",
                            cursor: "pointer",
                          }}
                        >
                          Probe
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            setNodeActionStatus(`Syncing sessions with ${node.name}...`);
                            const s = await gatewayClient.syncNodeSessions(node.id);
                            setNodeActionStatus(
                              s.ok
                                ? `✓ Synced ${s.syncedCount ?? 0} sessions with ${node.name}`
                                : `✗ Sync error: ${s.error || "failed"}`,
                            );
                          }}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            background: "var(--bg-card)",
                            border: "1px solid var(--border-medium)",
                            color: "var(--accent-teal)",
                            fontSize: "11px",
                            cursor: "pointer",
                          }}
                        >
                          Sync
                        </button>
                        {node.id !== "local" && (
                          <button
                            type="button"
                            onClick={async () => {
                              await gatewayClient.deleteRemoteNode(node.id);
                              await fetchNodes();
                            }}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "var(--ink-muted)",
                              cursor: "pointer",
                              padding: "2px",
                            }}
                          >
                            <TrashIcon size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </SettingGroup>

              <SettingGroup title="ADD REMOTE NODE">
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    background: "var(--bg-input)",
                    padding: "14px",
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <input
                      type="text"
                      placeholder="Node Name (e.g. Frankfurt VPS)"
                      value={newNodeName}
                      onChange={(e) => setNewNodeName(e.target.value)}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "6px",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-medium)",
                        color: "var(--ink-primary)",
                        fontSize: "12px",
                      }}
                    />
                    <select
                      value={newNodeKind}
                      onChange={(e) => setNewNodeKind(e.target.value as RemoteNodeKind)}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "6px",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-medium)",
                        color: "var(--ink-primary)",
                        fontSize: "12px",
                      }}
                    >
                      <option value="vps">VPS (Cloud Server 24/7)</option>
                      <option value="tailscale">Tailscale Mesh Gateway</option>
                      <option value="docker">Docker Container</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    placeholder="Node Gateway URL (e.g. http://100.x.y.z:18789)"
                    value={newNodeUrl}
                    onChange={(e) => setNewNodeUrl(e.target.value)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "6px",
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-medium)",
                      color: "var(--ink-primary)",
                      fontSize: "12px",
                    }}
                  />
                  <input
                    type="password"
                    placeholder="Bearer Auth Token (Optional)"
                    value={newNodeToken}
                    onChange={(e) => setNewNodeToken(e.target.value)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "6px",
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-medium)",
                      color: "var(--ink-primary)",
                      fontSize: "12px",
                    }}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!newNodeName.trim() || !newNodeUrl.trim()) return;
                      const res = await gatewayClient.saveRemoteNode({
                        name: newNodeName.trim(),
                        url: newNodeUrl.trim(),
                        kind: newNodeKind,
                        bearerToken: newNodeToken.trim() || undefined,
                      });
                      if (res.ok) {
                        setNewNodeName("");
                        setNewNodeUrl("");
                        setNewNodeToken("");
                        setNodeActionStatus(`✓ Added remote node "${res.node?.name}"`);
                        await fetchNodes();
                      }
                    }}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "6px",
                      background: "var(--accent-teal)",
                      border: "none",
                      color: "#000000",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      alignSelf: "flex-start",
                    }}
                  >
                    Save Node
                  </button>
                </div>
              </SettingGroup>
            </div>
          )}

          {/* 9. AUTOMATIONS CATEGORY */}
          {activeSection === "automations" && (
            <div>
              <SettingGroup title="BACKGROUND CRON JOBS">
                <p
                  style={{ fontSize: "12px", color: "var(--ink-secondary)", marginBottom: "16px" }}
                >
                  Configure autonomous scheduled background routines maintained by the CoreBlow
                  runtime.
                </p>
                {[
                  {
                    key: "repoHealth" as const,
                    label: "Daily Repository Health Check",
                    desc: "Runs git check, linting, and dependency validation every night at 02:00.",
                  },
                  {
                    key: "memoryCompaction" as const,
                    label: "Cory Memory Compaction",
                    desc: "Summarizes episodic context into semantic vector indexes every 6 hours.",
                  },
                  {
                    key: "evoloopDistillation" as const,
                    label: "EvoLoop Skill Distillation",
                    desc: "Distills repetitive multi-step actions into reusable procedural skills.",
                  },
                  {
                    key: "logPruning" as const,
                    label: "Weekly Log Pruning",
                    desc: "Prunes tool execution logs and debug traces older than 14 days.",
                  },
                ].map((item) => (
                  <SettingRow key={item.key} label={item.label} description={item.desc}>
                    <ToggleSwitch
                      checked={preferences.automations?.[item.key] ?? false}
                      onChange={(checked) =>
                        onUpdatePreferences({
                          automations: {
                            ...preferences.automations,
                            [item.key]: checked,
                          },
                        })
                      }
                      ariaLabel={`Toggle ${item.label}`}
                    />
                  </SettingRow>
                ))}
              </SettingGroup>
            </div>
          )}

          {/* 10. ABOUT CATEGORY */}
          {activeSection === "about" && (
            <div>
              <SettingGroup title="ABOUT COREBLOW STUDIO">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    marginBottom: "20px",
                  }}
                >
                  <CoreBlowBrandSwirl size={48} />
                  <div>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--ink-primary)" }}>
                      CoreBlow Studio
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--ink-muted)" }}>
                      Version 2.6.0 (Release) • Cross-Platform Desktop
                    </div>
                  </div>
                </div>

                <SettingRow label="Updates" description={describeUpdateStatus(updateStatus)}>
                  <button
                    type="button"
                    onClick={() => {
                      if (onCheckForUpdates) {
                        onCheckForUpdates();
                      } else {
                        window.coreblowDesktop?.updater?.checkForUpdates().catch(() => {});
                      }
                    }}
                    disabled={updateStatus?.phase === "checking"}
                    style={{
                      padding: "5px 12px",
                      borderRadius: "6px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-medium)",
                      color: "var(--ink-primary)",
                      fontSize: "12px",
                      cursor: updateStatus?.phase === "checking" ? "wait" : "pointer",
                    }}
                  >
                    {updateStatus?.phase === "checking" ? "Checking..." : "Check for Updates"}
                  </button>
                </SettingRow>

                <SettingRow label="Application ID">
                  <span
                    style={{
                      fontSize: "12px",
                      fontFamily: "var(--font-mono)",
                      color: "var(--ink-secondary)",
                    }}
                  >
                    ai.coreblow.studio
                  </span>
                </SettingRow>

                <SettingRow label="Architecture">
                  <span style={{ fontSize: "12px", color: "var(--ink-secondary)" }}>
                    Single-Brain Quiet-Instrument Gateway (:18789)
                  </span>
                </SettingRow>

                <SettingRow label="Official Documentation">
                  <a
                    href="https://docs.coreblow.com"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: "12.5px",
                      color: "var(--accent-teal)",
                      textDecoration: "none",
                    }}
                  >
                    https://docs.coreblow.com
                  </a>
                </SettingRow>
              </SettingGroup>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
