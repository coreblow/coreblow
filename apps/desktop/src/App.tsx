import React, { useState, useEffect, useRef, useCallback } from "react";
import { Layout } from "./components/Layout";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { ConversationArea } from "./components/ConversationArea";
import { InspectorDrawer } from "./components/InspectorDrawer";
import { SettingsModal } from "./components/SettingsModal";
import { StatusBar } from "./components/StatusBar";
import { FirstRunSetup } from "./components/FirstRunSetup";
import { CommandPalette } from "./components/CommandPalette";
import { storageService } from "./services/storage";
import { gatewayClient } from "./services/gateway-client";
import type {
  ActiveProjectState,
  ChatMessage,
  ChatThread,
  ModelTier,
  PermissionMode,
  RemoteNodeConfig,
  ToolExecutionStep,
} from "./types/gateway";

export const App: React.FC = () => {
  // Storage & State Initialization
  const [threads, setThreads] = useState<ChatThread[]>(() => storageService.getThreads());
  const [activeThreadId, setActiveThreadId] = useState<string | null>(() => storageService.getActiveThreadId());
  const [preferences, setPreferences] = useState(() => {
    const p = storageService.getPreferences();
    return {
      ...p,
      inspectorOpen: p.layoutMode === "pro",
    };
  });
  const [project, setProject] = useState<ActiveProjectState>(() => storageService.getProject());

  const [prompt, setPrompt] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<any>(undefined);
  const [gatewayHealthy, setGatewayHealthy] = useState(true);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Always-On 24/7 Remote Nodes state
  const [nodes, setNodes] = useState<RemoteNodeConfig[]>([
    {
      id: "local",
      name: "Local Gateway",
      url: "http://127.0.0.1:18789",
      kind: "local",
      enabled: true,
      healthy: true,
      latencyMs: 1,
    },
  ]);
  const [activeNodeId, setActiveNodeId] = useState<string>(() => {
    try {
      return localStorage.getItem("coreblow_active_node_id") || "local";
    } catch {
      return "local";
    }
  });
  const [isSyncingSessions, setIsSyncingSessions] = useState(false);

  // Live Voice Mode state
  const [autoSpeak, setAutoSpeak] = useState<boolean>(() => {
    try {
      return localStorage.getItem("coreblow_auto_speak") === "true";
    } catch {
      return false;
    }
  });
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Active Model, Agent Teamwork, and Execution Mode
  const [activeModel, setActiveModel] = useState<string>(
    preferences.activeModel || "Auto (DecisionRouter)",
  );
  const [agentTeamwork, setAgentTeamwork] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("coreblow_agent_teamwork");
      if (stored !== null) return stored === "true";
      return preferences.agentTeamwork ?? false;
    } catch {
      return false;
    }
  });
  const [executionMode, setExecutionMode] = useState<"standard" | "autonomous" | "warroom">(
    preferences.executionMode || "standard",
  );
  const [estopPaused, setEstopPaused] = useState(false);

  useEffect(() => {
    // 1. Initialize OS Keychain Vault and transparently decrypt secrets
    storageService.initVault().then((decrypted) => {
      setPreferences((prev) => ({
        ...prev,
        ...decrypted,
        inspectorOpen: prev.inspectorOpen,
      }));
    });

    // 2. Load initial E-Stop state
    gatewayClient.getEstopState().then((state) => {
      setEstopPaused(state.paused);
    });
  }, []);

  const switchOrLoadSession = useCallback(async (sessionId: string) => {
    if (!sessionId) return;
    setActiveThreadId(sessionId);
    setThreads((curr) => {
      if (!curr.some((t) => t.id === sessionId)) {
        return [
          {
            id: sessionId,
            title: `Session ${sessionId.slice(0, 8)}`,
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            executionProfile: preferences.permissionMode,
            model: preferences.modelTier,
          },
          ...curr,
        ];
      }
      return curr;
    });

    try {
      const remote = await gatewayClient.getSession(sessionId);
      if (remote) {
        setThreads((curr) => {
          const exists = curr.some((t) => t.id === remote.id);
          if (exists) {
            return curr.map((t) => (t.id === remote.id ? remote : t));
          }
          return [remote, ...curr];
        });
      }
    } catch {}
  }, []);

  // Listen for CLI session handoff (initial or warm second-instance)
  useEffect(() => {
    if (window.coreblowDesktop?.session) {
      window.coreblowDesktop.session.getInitialSessionId().then((initialId) => {
        if (initialId) {
          switchOrLoadSession(initialId);
        }
      });
      const unsubscribe = window.coreblowDesktop.session.onHandoff((handedId) => {
        if (handedId) {
          switchOrLoadSession(handedId);
        }
      });
      return () => {
        unsubscribe();
      };
    }
  }, [switchOrLoadSession]);

  const handleToggleEstop = async () => {
    const next = !estopPaused;
    const res = await gatewayClient.setEstopPaused(next, next ? "Paused via Desktop UI" : undefined);
    setEstopPaused(res.paused);
  };

  const handleToggleAgentTeamwork = (enabled: boolean) => {
    setAgentTeamwork(enabled);
    setPreferences((p) => ({ ...p, agentTeamwork: enabled }));
    try {
      localStorage.setItem("coreblow_agent_teamwork", String(enabled));
    } catch {}
  };

  const handleChangeExecutionMode = (mode: "standard" | "autonomous" | "warroom") => {
    setExecutionMode(mode);
    setPreferences((p) => ({ ...p, executionMode: mode }));
    if (mode === "warroom") {
      handleToggleAgentTeamwork(true);
    }
  };

  const handleChangeActiveModel = (model: string) => {
    setActiveModel(model);
    setPreferences((p) => ({ ...p, activeModel: model }));
  };

  const handleSelectWorkspace = async () => {
    if (window.coreblowDesktop?.dialog?.selectDirectory) {
      const newPath = await window.coreblowDesktop.dialog.selectDirectory();
      if (newPath) {
        const name = newPath.split("/").pop() || newPath;
        setProject((p) => ({ ...p, path: newPath, name }));
      }
    } else {
      const fallbackPaths = ["~/coreblow", "~/workspaces/agent-suite", "~/dev/sovereign-kernel"];
      const nextIdx = (fallbackPaths.indexOf(project.path) + 1) % fallbackPaths.length;
      const newPath = fallbackPaths[nextIdx];
      const name = newPath.split("/").pop() || newPath;
      setProject((p) => ({ ...p, path: newPath, name }));
    }
  };

  const abortControllerRef = useRef<AbortController | null>(null);

  // Active Thread
  const activeThread = threads.find((t) => t.id === activeThreadId) || null;
  const messages = activeThread ? activeThread.messages : [];

  // Persist threads whenever they change
  useEffect(() => {
    storageService.saveThreads(threads);
  }, [threads]);

  // Persist active thread id
  useEffect(() => {
    storageService.setActiveThreadId(activeThreadId);
  }, [activeThreadId]);

  // Persist preferences
  useEffect(() => {
    storageService.savePreferences(preferences);
  }, [preferences]);

  // Synchronize dynamic theme and accent color on document root
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", preferences.themeMode || "dark");
      if (preferences.accentColor) {
        document.documentElement.style.setProperty("--accent-teal", preferences.accentColor);
        document.documentElement.style.setProperty("--accent-teal-glow", `${preferences.accentColor}33`);
        document.documentElement.style.setProperty("--accent-teal-subtle", `${preferences.accentColor}18`);
      }
    }
  }, [preferences.themeMode, preferences.accentColor]);

  const handleTogglePinThread = (id: string) => {
    setThreads((prev) =>
      prev.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t)),
    );
  };

  const handleToggleLayoutMode = (mode?: "basic" | "pro") => {
    const next = mode || (preferences.layoutMode === "basic" ? "pro" : "basic");
    setPreferences((p) => ({
      ...p,
      layoutMode: next,
      inspectorOpen: next === "pro",
    }));
  };

  const handleSaveApiKey = (provider: "anthropic" | "openai" | "gemini" | "groq", key: string) => {
    const map = {
      anthropic: "anthropicApiKey",
      openai: "openAiApiKey",
      gemini: "geminiApiKey",
      groq: "groqApiKey",
    } as const;
    setPreferences((p) => ({ ...p, [map[provider]]: key }));
  };

  const handleSetupComplete = () => {
    setPreferences((p) => ({ ...p, setupCompleted: true }));
    setShowSetupWizard(false);
  };

  const handleSetupSkip = () => {
    setPreferences((p) => ({ ...p, setupCompleted: true }));
    setShowSetupWizard(false);
  };

  // Persist project
  useEffect(() => {
    storageService.saveProject(project);
  }, [project]);

  // Gateway health check polling
  const checkHealth = useCallback(async () => {
    const ok = await gatewayClient.checkHealth();
    setGatewayHealthy(ok);
  }, []);

  const loadNodes = useCallback(async () => {
    try {
      const list = await gatewayClient.listNodes();
      if (list && list.length > 0) {
        setNodes(list);
      }
    } catch {}
  }, []);

  useEffect(() => {
    checkHealth();
    loadNodes();
    const interval = setInterval(() => {
      checkHealth();
    }, 5000);
    return () => clearInterval(interval);
  }, [checkHealth, loadNodes]);

  // Handle active node change: update gateway client target & reload sessions
  useEffect(() => {
    const targetNode = nodes.find((n) => n.id === activeNodeId) || nodes[0];
    if (targetNode) {
      gatewayClient.setTargetNode(targetNode.url, targetNode.bearerToken);
      checkHealth();

      gatewayClient.listSessions().then((remoteSessions) => {
        if (!remoteSessions || remoteSessions.length === 0) return;
        setThreads((localThreads) => {
          const localMap = new Map(localThreads.map((t) => [t.id, t]));
          for (const rem of remoteSessions) {
            const local = localMap.get(rem.id);
            if (!local || rem.updatedAt > local.updatedAt) {
              localMap.set(rem.id, rem);
            }
          }
          return Array.from(localMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
        });
      });
    }

    try {
      localStorage.setItem("coreblow_active_node_id", activeNodeId);
    } catch {}
  }, [activeNodeId, nodes, checkHealth]);

  const handleSelectNode = (nodeId: string) => {
    setActiveNodeId(nodeId);
  };

  const handleSyncSessions = async () => {
    setIsSyncingSessions(true);
    try {
      const res = await gatewayClient.syncNodeSessions(activeNodeId);
      if (res.ok) {
        const reloaded = await gatewayClient.listSessions();
        if (reloaded.length > 0) {
          setThreads(reloaded);
        }
      }
    } finally {
      setIsSyncingSessions(false);
    }
  };

  const speakReply = useCallback((text: string) => {
    if (!text.trim()) return;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const handleStopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const handleToggleAutoSpeak = () => {
    setAutoSpeak((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("coreblow_auto_speak", String(next));
      } catch {}
      if (!next) {
        handleStopSpeaking();
      }
      return next;
    });
  };

  const handleReconnectGateway = async () => {
    if (window.coreblowDesktop) {
      await window.coreblowDesktop.gateway.ensure();
    }
    await checkHealth();
    await loadNodes();
  };

  // Thread actions
  const handleNewThread = () => {
    const newId = `thread_${Date.now()}`;
    const newThread: ChatThread = {
      id: newId,
      title: "New Conversation",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      executionProfile: preferences.permissionMode,
      model: preferences.modelTier,
      cwd: project.path,
    };
    setThreads((prev) => [newThread, ...prev]);
    setActiveThreadId(newId);
  };

  const handleDeleteThread = (id: string) => {
    setThreads((prev) => prev.filter((t) => t.id !== id));
    gatewayClient.deleteSession(id).catch(() => {});
    if (activeThreadId === id) {
      const remaining = threads.filter((t) => t.id !== id);
      setActiveThreadId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleSelectThread = (id: string) => {
    setActiveThreadId(id);
  };

  const handleInstantScreenCapture = async () => {
    if (window.coreblowDesktop?.screen?.captureActive) {
      try {
        const filePath = await window.coreblowDesktop.screen.captureActive();
        if (filePath) {
          setAttachedFiles((prev) => Array.from(new Set([...prev, filePath])));
        }
      } catch {
        // Screenshot capture error
      }
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setPreferences((p) => ({ ...p, inspectorOpen: true, inspectorTab: "files" }));
      } else if (e.ctrlKey && (e.key === "`" || e.code === "Backquote")) {
        e.preventDefault();
        setPreferences((p) => ({ ...p, inspectorOpen: true, inspectorTab: "terminal" }));
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "t") {
        e.preventDefault();
        setPreferences((p) => ({ ...p, inspectorOpen: true, inspectorTab: "browser" }));
      } else if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        window.coreblowDesktop?.window?.toggleHud?.();
      } else if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleInstantScreenCapture();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleNewThread();
      } else if (isCmdOrCtrl && e.key === ",") {
        e.preventDefault();
        setSettingsOpen((prev) => !prev);
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "i") {
        e.preventDefault();
        setPreferences((p) => ({ ...p, inspectorOpen: !p.inspectorOpen }));
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setPreferences((p) => ({ ...p, sidebarCollapsed: !p.sidebarCollapsed }));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [threads, preferences]);

  // Main chat submission handler
  const handleSend = async () => {
    const currentPrompt = prompt.trim();
    if (!currentPrompt || isStreaming) return;

    // Ensure we have an active thread
    let targetThreadId = activeThreadId;
    if (!targetThreadId) {
      targetThreadId = `thread_${Date.now()}`;
      const newThread: ChatThread = {
        id: targetThreadId,
        title: currentPrompt.slice(0, 30) + (currentPrompt.length > 30 ? "..." : ""),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
        executionProfile: preferences.permissionMode,
        model: preferences.modelTier,
        cwd: project.path,
      };
      setThreads((prev) => [newThread, ...prev]);
      setActiveThreadId(targetThreadId);
    }

    const userMessageId = `msg_${Date.now()}`;
    const assistantMessageId = `msg_${Date.now() + 1}`;

    const userMessage: ChatMessage = {
      id: userMessageId,
      role: "user",
      content: currentPrompt,
      timestamp: Date.now(),
      attachedFiles: attachedFiles.length > 0 ? [...attachedFiles] : undefined,
    };

    const assistantPlaceholder: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: Date.now() + 1,
      streaming: true,
      toolSteps: [],
    };

    // Append user & assistant placeholder to active thread
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id === targetThreadId) {
          const isFirstTurn = t.messages.length === 0;
          return {
            ...t,
            title: isFirstTurn
              ? currentPrompt.slice(0, 32) + (currentPrompt.length > 32 ? "..." : "")
              : t.title,
            updatedAt: Date.now(),
            messages: [...t.messages, userMessage, assistantPlaceholder],
          };
        }
        return t;
      }),
    );

    // Clear input
    setPrompt("");
    setAttachedFiles([]);
    setIsStreaming(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Build context messages from history (up to last 10 turns)
    const contextMessages = (activeThread?.messages || []).map((m) => ({
      role: m.role,
      content: m.content,
    }));
    contextMessages.push({ role: "user", content: currentPrompt });

    try {
      await gatewayClient.streamChat(
        {
          sessionId: targetThreadId,
          prompt: currentPrompt,
          messages: contextMessages,
          executionProfile: preferences.permissionMode,
          cwd: project.path,
          modelTier: preferences.modelTier,
          agentTeamwork: agentTeamwork,
          signal: abortController.signal,
          credentials: {
            anthropicApiKey: preferences.anthropicApiKey || undefined,
            openAiApiKey: preferences.openAiApiKey || undefined,
            geminiApiKey: preferences.geminiApiKey || undefined,
            groqApiKey: preferences.groqApiKey || undefined,
            localOllamaUrl: preferences.localOllamaUrl || undefined,
          },
        },
        {
          onDelta: (delta: string) => {
            setThreads((prev) =>
              prev.map((t) => {
                if (t.id === targetThreadId) {
                  return {
                    ...t,
                    messages: t.messages.map((m) =>
                      m.id === assistantMessageId ? { ...m, content: m.content + delta } : m,
                    ),
                  };
                }
                return t;
              }),
            );
          },
          onToolStep: (toolStep: ToolExecutionStep) => {
            setThreads((prev) =>
              prev.map((t) => {
                if (t.id === targetThreadId) {
                  return {
                    ...t,
                    messages: t.messages.map((m) => {
                      if (m.id === assistantMessageId) {
                        const existingSteps = m.toolSteps || [];
                        const existingIndex = existingSteps.findIndex((s) => s.stepIndex === toolStep.stepIndex);
                        let updatedSteps: ToolExecutionStep[];
                        if (existingIndex >= 0) {
                          updatedSteps = [...existingSteps];
                          updatedSteps[existingIndex] = { ...updatedSteps[existingIndex], ...toolStep };
                        } else {
                          updatedSteps = [...existingSteps, toolStep];
                        }
                        return { ...m, toolSteps: updatedSteps };
                      }
                      return m;
                    }),
                  };
                }
                return t;
              }),
            );
          },
          onDone: (fullReply: string) => {
            setIsStreaming(false);
            if (autoSpeak && fullReply) {
              speakReply(fullReply);
            }
            setThreads((prev) =>
              prev.map((t) => {
                if (t.id === targetThreadId) {
                  return {
                    ...t,
                    messages: t.messages.map((m) =>
                      m.id === assistantMessageId ? { ...m, streaming: false } : m,
                    ),
                  };
                }
                return t;
              }),
            );
          },
          onError: (err) => {
            setIsStreaming(false);
            setThreads((prev) =>
              prev.map((t) => {
                if (t.id === targetThreadId) {
                  return {
                    ...t,
                    messages: t.messages.map((m) =>
                      m.id === assistantMessageId
                        ? { ...m, streaming: false, error: err.message }
                        : m,
                    ),
                  };
                }
                return t;
              }),
            );
          },
        },
      );
    } catch {
      setIsStreaming(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    handleStopSpeaking();
    setIsStreaming(false);
  };

  return (
    <>
      <Layout
        sidebar={
          <Sidebar
            threads={threads}
            activeThreadId={activeThreadId}
            onSelectThread={handleSelectThread}
            onNewThread={handleNewThread}
            onDeleteThread={handleDeleteThread}
            onTogglePinThread={handleTogglePinThread}
            collapsed={preferences.sidebarCollapsed}
            onToggleCollapse={() =>
              setPreferences((p) => ({ ...p, sidebarCollapsed: !p.sidebarCollapsed }))
            }
            onOpenSettings={(section) => {
              setSettingsSection(section as any);
              setSettingsOpen(true);
            }}
            onOpenTab={(tab) => {
              setPreferences((p) => ({ ...p, inspectorOpen: true, inspectorTab: tab }));
            }}
          />
        }
        topbar={
          <Topbar
            sidebarCollapsed={preferences.sidebarCollapsed}
            inspectorOpen={preferences.inspectorOpen}
            onToggleInspector={() =>
              setPreferences((p) => ({ ...p, inspectorOpen: !p.inspectorOpen }))
            }
          />
        }
        content={
          <ConversationArea
            messages={messages}
            prompt={prompt}
            onChangePrompt={setPrompt}
            onSend={handleSend}
            onStop={handleStop}
            isStreaming={isStreaming}
            permissionMode={preferences.permissionMode}
            onChangePermissionMode={(mode) =>
              setPreferences((p) => ({ ...p, permissionMode: mode }))
            }
            modelTier={preferences.modelTier}
            onChangeModelTier={(tier) => setPreferences((p) => ({ ...p, modelTier: tier }))}
            activeModel={activeModel}
            onChangeActiveModel={handleChangeActiveModel}
            agentTeamwork={agentTeamwork}
            onToggleAgentTeamwork={handleToggleAgentTeamwork}
            executionMode={executionMode}
            onChangeExecutionMode={handleChangeExecutionMode}
            attachedFiles={attachedFiles}
            onAddFiles={(files) => setAttachedFiles((prev) => [...prev, ...files])}
            onRemoveFile={(file) =>
              setAttachedFiles((prev) => prev.filter((f) => f !== file))
            }
            projectName={project.name}
            projectBranch={project.branch}
            onSelectWorkspace={handleSelectWorkspace}
            autoSpeak={autoSpeak}
            onToggleAutoSpeak={handleToggleAutoSpeak}
            isSpeaking={isSpeaking}
            onStopSpeaking={handleStopSpeaking}
            showOnboarding={preferences.setupCompleted && !preferences.onboardingCompleted}
            onboardingProps={{
              userName: preferences.userName,
              onUpdateUserName: (name: string) => {
                setPreferences((p) => ({ ...p, userName: name }));
                gatewayClient.rememberMemory(`User prefers to be called ${name}`, "identity").catch(() => {});
              },
              accentColor: preferences.accentColor || "#2DD4BF",
              onUpdateAccentColor: (color: string) => {
                setPreferences((p) => ({ ...p, accentColor: color }));
              },
              themeMode: preferences.themeMode || "dark",
              onUpdateThemeMode: (mode: "dark" | "light") => {
                setPreferences((p) => ({ ...p, themeMode: mode }));
              },
              layoutMode: preferences.layoutMode || "basic",
              onUpdateLayoutMode: (mode: "basic" | "pro") => {
                setPreferences((p) => ({ ...p, layoutMode: mode, inspectorOpen: mode === "pro" }));
              },
              onSaveApiKey: handleSaveApiKey,
              onFinish: () => setPreferences((p) => ({ ...p, onboardingCompleted: true })),
              onSkip: () => setPreferences((p) => ({ ...p, onboardingCompleted: true })),
            }}
          />
        }
        inspector={
          <InspectorDrawer
            open={preferences.inspectorOpen}
            onClose={() => setPreferences((p) => ({ ...p, inspectorOpen: false }))}
            activeTab={preferences.inspectorTab}
            onChangeTab={(tab) => setPreferences((p) => ({ ...p, inspectorTab: tab }))}
            project={project}
            onAttachFile={(path) => setAttachedFiles((prev) => [...prev, path])}
          />
        }
        statusBar={undefined}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          setSettingsSection(undefined);
          loadNodes();
        }}
        preferences={preferences}
        onUpdatePreferences={(p) => setPreferences((prev) => ({ ...prev, ...p }))}
        initialSection={settingsSection}
        onRunSetupWizard={() => {
          setSettingsOpen(false);
          setShowSetupWizard(true);
        }}
      />

      {(!preferences.setupCompleted || showSetupWizard) && (
        <FirstRunSetup
          onComplete={handleSetupComplete}
          onSkip={handleSetupSkip}
        />
      )}

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={handleSelectThread}
        onNewChat={handleNewThread}
        onToggleLayoutMode={handleToggleLayoutMode}
        layoutMode={preferences.layoutMode || "basic"}
        onToggleHud={() => window.coreblowDesktop?.window?.toggleHud?.()}
        onCaptureScreen={handleInstantScreenCapture}
        onRollback={() => gatewayClient.rollbackCheckpoint().catch(() => {})}
        onToggleEstop={handleToggleEstop}
        estopPaused={estopPaused}
        onOpenSettings={(section) => {
          setSettingsSection(section);
          setSettingsOpen(true);
        }}
        onSyncSessions={() => handleSyncSessions()}
        onRunSetupWizard={() => {
          setShowSetupWizard(true);
        }}
      />
    </>
  );
};
