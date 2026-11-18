import React, { useState, useEffect, useRef, useCallback } from "react";
import { Layout } from "./components/Layout";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { ConversationArea } from "./components/ConversationArea";
import { InspectorDrawer } from "./components/InspectorDrawer";
import { SettingsModal } from "./components/SettingsModal";
import { storageService } from "./services/storage";
import { gatewayClient } from "./services/gateway-client";
import type {
  ActiveProjectState,
  ChatMessage,
  ChatThread,
  ModelTier,
  PermissionMode,
  ToolExecutionStep,
} from "./types/gateway";

export const App: React.FC = () => {
  // Storage & State Initialization
  const [threads, setThreads] = useState<ChatThread[]>(() => storageService.getThreads());
  const [activeThreadId, setActiveThreadId] = useState<string | null>(() => storageService.getActiveThreadId());
  const [preferences, setPreferences] = useState(() => storageService.getPreferences());
  const [project, setProject] = useState<ActiveProjectState>(() => storageService.getProject());

  const [prompt, setPrompt] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gatewayHealthy, setGatewayHealthy] = useState(true);

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

  // Persist project
  useEffect(() => {
    storageService.saveProject(project);
  }, [project]);

  // Gateway health check polling
  const checkHealth = useCallback(async () => {
    const ok = await gatewayClient.checkHealth();
    setGatewayHealthy(ok);
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  // Sync sessions from Gateway Unified Session Store
  useEffect(() => {
    if (!gatewayHealthy) return;
    let cancelled = false;
    gatewayClient.listSessions().then((remoteSessions) => {
      if (cancelled || remoteSessions.length === 0) return;
      setThreads((localThreads) => {
        const localMap = new Map(localThreads.map((t) => [t.id, t]));
        for (const rem of remoteSessions) {
          const local = localMap.get(rem.id);
          if (!local || rem.updatedAt > local.updatedAt) {
            localMap.set(rem.id, rem);
          }
        }
        const merged = Array.from(localMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
        return merged;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [gatewayHealthy]);

  const handleReconnectGateway = async () => {
    if (window.coreblowDesktop) {
      await window.coreblowDesktop.gateway.ensure();
    }
    await checkHealth();
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

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleNewThread();
      } else if (isCmdOrCtrl && e.key === ",") {
        e.preventDefault();
        setSettingsOpen((prev) => !prev);
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "i") {
        e.preventDefault();
        setPreferences((p) => ({ ...p, inspectorOpen: !p.inspectorOpen }));
      } else if (isCmdOrCtrl && e.key.toLowerCase() === "o") {
        e.preventDefault();
        if (window.coreblowDesktop) {
          window.coreblowDesktop.dialog.selectDirectory().then((dir) => {
            if (dir) {
              const name = dir.split("/").pop() || dir;
              setProject((p) => ({ ...p, path: dir, name }));
            }
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Send turn with SSE streaming against 127.0.0.1:18789
  const handleSend = async () => {
    if (!prompt.trim() || isStreaming) return;

    let targetThreadId = activeThreadId;
    let currentThreads = threads;

    // Ensure we have an active thread
    if (!targetThreadId || !threads.some((t) => t.id === targetThreadId)) {
      const newId = `thread_${Date.now()}`;
      const newThread: ChatThread = {
        id: newId,
        title: prompt.slice(0, 36) + (prompt.length > 36 ? "..." : ""),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
        executionProfile: preferences.permissionMode,
        model: preferences.modelTier,
        cwd: project.path,
      };
      targetThreadId = newId;
      currentThreads = [newThread, ...threads];
      setThreads(currentThreads);
      setActiveThreadId(newId);
    }

    const effectivePrompt = attachedFiles.length > 0
      ? `${prompt}\n\n[Attached Files for Inspection]:\n${attachedFiles.map((f) => `- ${f}`).join("\n")}`
      : prompt;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: "user",
      content: prompt,
      attachedFiles: attachedFiles.length > 0 ? [...attachedFiles] : undefined,
      timestamp: Date.now(),
    };

    const assistantMessageId = `msg_${Date.now()}_assistant`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      streaming: true,
      toolSteps: [],
    };

    // Update target thread with user and initial assistant message
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id === targetThreadId) {
          const title = t.messages.length === 0 ? prompt.slice(0, 36) + (prompt.length > 36 ? "..." : "") : t.title;
          return {
            ...t,
            title,
            updatedAt: Date.now(),
            messages: [...t.messages, userMessage, assistantMessage],
          };
        }
        return t;
      }),
    );

    setPrompt("");
    setAttachedFiles([]);
    setIsStreaming(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      await gatewayClient.streamChat(
        {
          sessionId: targetThreadId,
          prompt: effectivePrompt,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          executionProfile: preferences.permissionMode,
          cwd: project.path,
          modelTier: preferences.modelTier,
          credentials: {
            anthropicApiKey: preferences.anthropicApiKey,
            openAiApiKey: preferences.openAiApiKey,
            geminiApiKey: preferences.geminiApiKey,
            groqApiKey: preferences.groqApiKey,
            localOllamaUrl: preferences.localOllamaUrl,
            customApiKey: preferences.customApiKey,
          },
          signal: abortController.signal,
        },
        {
          onDelta: (delta) => {
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
          onStep: (step) => {
            setThreads((prev) =>
              prev.map((t) => {
                if (t.id === targetThreadId) {
                  return {
                    ...t,
                    messages: t.messages.map((m) => {
                      if (m.id === assistantMessageId) {
                        const existingSteps = m.toolSteps || [];
                        const existingIndex = existingSteps.findIndex((s) => s.stepIndex === step.stepIndex);
                        let updatedSteps: ToolExecutionStep[];
                        if (existingIndex >= 0) {
                          updatedSteps = [...existingSteps];
                          updatedSteps[existingIndex] = { ...updatedSteps[existingIndex], ...step };
                        } else {
                          updatedSteps = [...existingSteps, step];
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
          onToolStep: (toolStep) => {
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
          onDone: () => {
            setIsStreaming(false);
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
            collapsed={preferences.sidebarCollapsed}
            onToggleCollapse={() =>
              setPreferences((p) => ({ ...p, sidebarCollapsed: !p.sidebarCollapsed }))
            }
            onOpenSettings={() => setSettingsOpen(true)}
          />
        }
        topbar={
          <Topbar
            sidebarCollapsed={preferences.sidebarCollapsed}
            project={project}
            onChangeProject={(newPath) => {
              const name = newPath.split("/").pop() || newPath;
              setProject((p) => ({ ...p, path: newPath, name }));
            }}
            inspectorOpen={preferences.inspectorOpen}
            onToggleInspector={() =>
              setPreferences((p) => ({ ...p, inspectorOpen: !p.inspectorOpen }))
            }
            gatewayHealthy={gatewayHealthy}
            onReconnectGateway={handleReconnectGateway}
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
            attachedFiles={attachedFiles}
            onAddFiles={(files) => setAttachedFiles((prev) => [...prev, ...files])}
            onRemoveFile={(file) =>
              setAttachedFiles((prev) => prev.filter((f) => f !== file))
            }
            projectName={project.name}
            projectBranch={project.branch}
          />
        }
        inspector={
          <InspectorDrawer
            open={preferences.inspectorOpen}
            onClose={() => setPreferences((p) => ({ ...p, inspectorOpen: false }))}
            activeTab={preferences.inspectorTab}
            onChangeTab={(tab) => setPreferences((p) => ({ ...p, inspectorTab: tab }))}
            project={project}
          />
        }
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        preferences={preferences}
        onUpdatePreferences={(p) => setPreferences((prev) => ({ ...prev, ...p }))}
      />
    </>
  );
};
