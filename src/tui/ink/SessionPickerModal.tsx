import React, { useState, useEffect, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import {
  isSqliteAvailable,
  listSqliteSessions,
} from "../../sessions/sqlite-session-store.js";
import {
  listUnifiedSessions,
  type UnifiedSessionRecord,
} from "../../sessions/unified-session-store.js";
import { forkSession, renameSession } from "../../cli/session-resume.js";
import { inkPalette } from "./theme.js";

export interface SessionPickerModalProps {
  onSelect: (sessionId: string) => void;
  onClose: () => void;
}

export const SessionPickerModal: React.FC<SessionPickerModalProps> = ({
  onSelect,
  onClose,
}) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [mode, setMode] = useState<"navigate" | "rename">("navigate");
  const [renameInput, setRenameInput] = useState("");
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Load sessions from SQLite FTS5 / Unified store
  const sessions: UnifiedSessionRecord[] = useMemo(() => {
    try {
      if (isSqliteAvailable()) {
        return listSqliteSessions({ query: query.trim() || undefined, limit: 10 });
      }
      return listUnifiedSessions({ query: query.trim() || undefined, limit: 10 });
    } catch {
      return [];
    }
  }, [query, refreshTrigger]);

  const safeIndex = Math.min(Math.max(0, selectedIndex), Math.max(0, sessions.length - 1));
  const activeSession = sessions[safeIndex];

  // Preview snippet from last user/assistant exchange
  const previewSnippet = useMemo(() => {
    if (!activeSession || !Array.isArray(activeSession.messages) || activeSession.messages.length === 0) {
      return "(empty session)";
    }
    const msgs = activeSession.messages;
    const lastUser = [...msgs].reverse().find((m) => m.role === "user");
    const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant");

    const lines: string[] = [];
    if (lastUser) {
      lines.push(`User: ${lastUser.content.slice(0, 70)}`);
    }
    if (lastAssistant) {
      lines.push(`Assistant: ${lastAssistant.content.slice(0, 100)}`);
    }
    return lines.join("\n") || "(no text preview)";
  }, [activeSession]);

  useInput((input, key) => {
    // 1. Rename mode
    if (mode === "rename") {
      if (key.escape) {
        setMode("navigate");
        setRenameInput("");
        return;
      }
      if (key.return) {
        if (activeSession && renameInput.trim()) {
          try {
            renameSession(activeSession.id, renameInput.trim());
            setStatusNotice(`Renamed to "${renameInput.trim()}"`);
            setRefreshTrigger((prev) => prev + 1);
          } catch (err) {
            setStatusNotice(`Rename failed: ${String(err)}`);
          }
        }
        setMode("navigate");
        setRenameInput("");
        return;
      }
      if (key.backspace || key.delete) {
        setRenameInput((prev) => prev.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setRenameInput((prev) => prev + input);
      }
      return;
    }

    // 2. Navigation & Search mode
    if (key.escape) {
      onClose();
      return;
    }

    if (key.return) {
      if (activeSession) {
        onSelect(activeSession.id);
      }
      return;
    }

    if (input === "r" && activeSession && query.length === 0) {
      setMode("rename");
      setRenameInput(activeSession.title);
      return;
    }

    if (input === "f" && activeSession && query.length === 0) {
      try {
        const forked = forkSession(activeSession.id);
        setStatusNotice(`Forked session: ${forked.id}`);
        setRefreshTrigger((prev) => prev + 1);
      } catch (err) {
        setStatusNotice(`Fork failed: ${String(err)}`);
      }
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(sessions.length - 1, prev + 1));
      return;
    }

    if (key.backspace || key.delete) {
      setQuery((prev) => prev.slice(0, -1));
      setSelectedIndex(0);
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      setQuery((prev) => prev + input);
      setSelectedIndex(0);
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={inkPalette.accent}
      paddingX={2}
      paddingY={1}
      width={76}
    >
      <Box justifyContent="space-between">
        <Text bold color={inkPalette.accent}>
          CoreBlow Sessions (SQLite FTS5)
        </Text>
        <Text color={inkPalette.dim}>({sessions.length} matches)</Text>
      </Box>

      {statusNotice && (
        <Box marginY={0}>
          <Text color={inkPalette.link}>{statusNotice}</Text>
        </Box>
      )}

      {mode === "rename" ? (
        <Box flexDirection="column" marginY={1}>
          <Text bold color={inkPalette.accentSoft}>
            Rename Session:
          </Text>
          <Box marginY={0}>
            <Text color={inkPalette.accent}>❯ </Text>
            <Text color={inkPalette.text}>{renameInput || "type new title..."}</Text>
          </Box>
          <Text color={inkPalette.dim}>Press Enter to save, Esc to cancel.</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginY={1}>
          <Box>
            <Text color={inkPalette.dim}>Search: </Text>
            <Text color={inkPalette.text}>{query || "type to filter titles & messages..."}</Text>
          </Box>

          <Box flexDirection="column" marginY={1}>
            {sessions.map((s, idx) => {
              const isSelected = idx === safeIndex;
              const msgCount = s.messages?.length || 0;
              const dateStr = new Date(s.updatedAt || s.createdAt).toLocaleDateString();

              return (
                <Box key={s.id} justifyContent="space-between">
                  <Box>
                    <Text color={isSelected ? inkPalette.accent : inkPalette.dim}>
                      {isSelected ? "❯ " : "  "}
                    </Text>
                    <Text bold={isSelected} color={isSelected ? inkPalette.text : inkPalette.dim}>
                      {s.title.slice(0, 36)}
                    </Text>
                    <Text color={inkPalette.dim}> ({msgCount} msgs)</Text>
                  </Box>
                  <Text color={inkPalette.dim}>
                    {s.id.slice(0, 12)} · {dateStr}
                  </Text>
                </Box>
              );
            })}
            {sessions.length === 0 && (
              <Text color={inkPalette.dim}>No sessions found matching "{query}"</Text>
            )}
          </Box>

          {/* Snippet Preview */}
          {activeSession && (
            <Box
              flexDirection="column"
              borderStyle="single"
              borderTop
              borderColor={inkPalette.border}
              paddingTop={1}
            >
              <Text color={inkPalette.accentSoft} bold>
                Preview ({activeSession.title}):
              </Text>
              <Text color={inkPalette.dim}>{previewSnippet}</Text>
            </Box>
          )}

          <Box borderStyle="single" borderTop borderColor={inkPalette.border} justifyContent="space-between">
            <Text color={inkPalette.dim}>
              <Text bold color={inkPalette.text}>Enter</Text>: Resume · <Text bold color={inkPalette.text}>r</Text>: Rename · <Text bold color={inkPalette.text}>f</Text>: Fork · <Text bold color={inkPalette.text}>Esc</Text>: Cancel
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};
