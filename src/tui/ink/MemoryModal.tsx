import React, { useState, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import {
  getGlobalDialecticUserModel,
  getGlobalMemoryProposalStore,
  type DialecticSignal,
  type PendingMemoryProposal,
} from "../../memory/dialectic-user-model.js";
import { inkPalette } from "./theme.js";

export interface MemoryModalProps {
  onClose: () => void;
}

export const MemoryModal: React.FC<MemoryModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<"active" | "proposals">("active");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const dialecticModel = useMemo(() => getGlobalDialecticUserModel(), [refreshTrigger]);
  const proposalStore = useMemo(() => getGlobalMemoryProposalStore(), [refreshTrigger]);

  const activeTraits: DialecticSignal[] = useMemo(
    () => dialecticModel.getActiveTraits(),
    [dialecticModel, refreshTrigger],
  );

  const pendingProposals: PendingMemoryProposal[] = useMemo(
    () => proposalStore.listPendingProposals(),
    [proposalStore, refreshTrigger],
  );

  const currentListLength =
    activeTab === "active" ? activeTraits.length : pendingProposals.length;
  const safeIndex = Math.min(Math.max(0, selectedIndex), Math.max(0, currentListLength - 1));

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }

    // Tab or Left/Right switch tabs
    if (key.tab || key.leftArrow || key.rightArrow) {
      setActiveTab((prev) => (prev === "active" ? "proposals" : "active"));
      setSelectedIndex(0);
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(currentListLength - 1, prev + 1));
      return;
    }

    // In Proposals tab: 'a' to approve, 'x' to dismiss
    if (activeTab === "proposals" && pendingProposals.length > 0) {
      const selectedProposal = pendingProposals[safeIndex];
      if (selectedProposal) {
        if (input === "a") {
          proposalStore.resolveProposal(selectedProposal.id, "approve");
          setStatusNotice(`Approved memory proposal: "${selectedProposal.content.slice(0, 40)}"`);
          setRefreshTrigger((prev) => prev + 1);
          return;
        }
        if (input === "x") {
          proposalStore.resolveProposal(selectedProposal.id, "dismiss");
          setStatusNotice(`Rejected memory proposal.`);
          setRefreshTrigger((prev) => prev + 1);
          return;
        }
      }
    }

    // In Active tab: 'd' or delete to remove trait
    if (activeTab === "active" && activeTraits.length > 0) {
      const selectedTrait = activeTraits[safeIndex];
      if (selectedTrait && (input === "d" || key.delete)) {
        dialecticModel.removeSignal(selectedTrait.id);
        setStatusNotice(`Removed memory trait: "${selectedTrait.key}".`);
        setRefreshTrigger((prev) => prev + 1);
      }
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
          Cory Dialectic Memory Review
        </Text>
        <Box>
          <Text
            bold={activeTab === "active"}
            color={activeTab === "active" ? inkPalette.accent : inkPalette.dim}
          >
            [1] Active ({activeTraits.length})
          </Text>
          <Text color={inkPalette.dim}> · </Text>
          <Text
            bold={activeTab === "proposals"}
            color={activeTab === "proposals" ? inkPalette.accentSoft : inkPalette.dim}
          >
            [2] Pending ({pendingProposals.length})
          </Text>
        </Box>
      </Box>

      {statusNotice && (
        <Box marginY={0}>
          <Text color={inkPalette.link}>{statusNotice}</Text>
        </Box>
      )}

      {/* Tab 1: Active Memory Traits */}
      {activeTab === "active" && (
        <Box flexDirection="column" marginY={1}>
          <Text color={inkPalette.dim}>Verified user & project facts:</Text>
          <Box flexDirection="column" marginY={1}>
            {activeTraits.map((t, idx) => {
              const isSelected = idx === safeIndex;
              return (
                <Box key={t.id} justifyContent="space-between">
                  <Box>
                    <Text color={isSelected ? inkPalette.accent : inkPalette.dim}>
                      {isSelected ? "❯ " : "  "}
                    </Text>
                    <Text bold={isSelected} color={inkPalette.text}>
                      {t.dimension}:{t.key}
                    </Text>
                    <Text color={inkPalette.dim}> → {t.value.slice(0, 36)}</Text>
                  </Box>
                  <Text color={inkPalette.accentSoft}>
                    ({Math.round(t.confidence * 100)}%)
                  </Text>
                </Box>
              );
            })}
            {activeTraits.length === 0 && (
              <Text color={inkPalette.dim}>No active dialectic traits recorded yet.</Text>
            )}
          </Box>
          <Box borderStyle="single" borderTop borderColor={inkPalette.border} justifyContent="space-between">
            <Text color={inkPalette.dim}>
              <Text bold color={inkPalette.text}>Tab</Text>: Switch to Proposals · <Text bold color={inkPalette.text}>d</Text>: Delete · <Text bold color={inkPalette.text}>Esc</Text>: Close
            </Text>
          </Box>
        </Box>
      )}

      {/* Tab 2: Pending TrustZone Proposals */}
      {activeTab === "proposals" && (
        <Box flexDirection="column" marginY={1}>
          <Text color={inkPalette.dim}>TrustZone candidate memory proposals:</Text>
          <Box flexDirection="column" marginY={1}>
            {pendingProposals.map((p, idx) => {
              const isSelected = idx === safeIndex;
              return (
                <Box key={p.id} justifyContent="space-between">
                  <Box>
                    <Text color={isSelected ? inkPalette.accent : inkPalette.dim}>
                      {isSelected ? "❯ " : "  "}
                    </Text>
                    <Text bold={isSelected} color={inkPalette.text}>
                      [{p.targetLayer}] {p.content.slice(0, 42)}
                    </Text>
                  </Box>
                  <Text color={inkPalette.link}>
                    {p.source || "inferred"}
                  </Text>
                </Box>
              );
            })}
            {pendingProposals.length === 0 && (
              <Text color={inkPalette.dim}>No pending memory proposals.</Text>
            )}
          </Box>
          <Box borderStyle="single" borderTop borderColor={inkPalette.border} justifyContent="space-between">
            <Text color={inkPalette.dim}>
              <Text bold color={inkPalette.text}>a</Text>: Approve · <Text bold color={inkPalette.text}>x</Text>: Reject · <Text bold color={inkPalette.text}>Tab</Text>: Active Tab · <Text bold color={inkPalette.text}>Esc</Text>: Close
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};
