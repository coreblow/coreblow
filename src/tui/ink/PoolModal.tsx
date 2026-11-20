import React, { useState, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import {
  getGlobalCredentialPoolManager,
  type MaskedPooledCredential,
} from "../../providers/credential-pool.js";
import { inkPalette } from "./theme.js";

export interface PoolModalProps {
  onClose: () => void;
}

export const PoolModal: React.FC<PoolModalProps> = ({ onClose }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const poolManager = useMemo(() => getGlobalCredentialPoolManager(), [refreshTrigger]);
  const maskedData = useMemo(() => poolManager.getMaskedPools(), [poolManager, refreshTrigger]);

  const flatCredentials = useMemo(() => {
    const list: Array<MaskedPooledCredential & { provider: string }> = [];
    for (const [provider, keys] of Object.entries(maskedData.pools)) {
      for (const k of keys) {
        list.push({ ...k, provider });
      }
    }
    return list;
  }, [maskedData]);

  const safeIndex = Math.min(Math.max(0, selectedIndex), Math.max(0, flatCredentials.length - 1));
  const activeCred = flatCredentials[safeIndex];

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }

    if (input === "c") {
      poolManager.resetCooldown();
      setStatusNotice("All provider cooldowns reset successfully.");
      setRefreshTrigger((prev) => prev + 1);
      return;
    }

    if ((input === "d" || key.delete) && activeCred) {
      poolManager.removeCredential(activeCred.id);
      setStatusNotice(`Removed key ${activeCred.label || activeCred.id}.`);
      setRefreshTrigger((prev) => prev + 1);
      return;
    }

    if (key.return && activeCred) {
      const nextEnabled = !activeCred.enabled;
      poolManager.setCredentialEnabled(activeCred.id, nextEnabled);
      setStatusNotice(`Key ${activeCred.label} is now ${nextEnabled ? "enabled" : "disabled"}.`);
      setRefreshTrigger((prev) => prev + 1);
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(flatCredentials.length - 1, prev + 1));
    }
  });

  const lifetimeCost = maskedData.telemetry?.lifetime?.estimatedCostUsd || 0;
  const lifetimeTokens = maskedData.telemetry?.lifetime?.totalTokens || 0;
  const chainStr = maskedData.fallbackChain.join(" → ") || "none";

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
          CoreBlow Credential Pool & Failover Monitor
        </Text>
        <Text color={inkPalette.dim}>({flatCredentials.length} keys pooled)</Text>
      </Box>

      {statusNotice && (
        <Box marginY={0}>
          <Text color={inkPalette.link}>{statusNotice}</Text>
        </Box>
      )}

      {/* Fallback Chain Order */}
      <Box marginY={0}>
        <Text color={inkPalette.dim}>Fallback Chain: </Text>
        <Text color={inkPalette.accentSoft}>{chainStr}</Text>
      </Box>

      {/* Keys List */}
      <Box flexDirection="column" marginY={1}>
        {flatCredentials.map((c, idx) => {
          const isSelected = idx === safeIndex;
          const isCooldown = Boolean(c.cooldownUntilMs && c.cooldownUntilMs > Date.now());
          const cooldownSec = isCooldown
            ? Math.ceil((c.cooldownUntilMs! - Date.now()) / 1000)
            : 0;

          return (
            <Box key={c.id} justifyContent="space-between">
              <Box>
                <Text color={isSelected ? inkPalette.accent : inkPalette.dim}>
                  {isSelected ? "❯ " : "  "}
                </Text>
                <Text bold={isSelected} color={c.enabled ? inkPalette.text : inkPalette.dim}>
                  {c.label || c.id}
                </Text>
                <Text color={inkPalette.dim}> [{c.apiKey}]</Text>
                {!c.enabled && <Text color={inkPalette.error}> (disabled)</Text>}
                {isCooldown && (
                  <Text color={inkPalette.accentSoft}> (cooldown {cooldownSec}s)</Text>
                )}
              </Box>
              <Text color={inkPalette.accent}>
                ${c.estimatedCostUsd.toFixed(3)}
              </Text>
            </Box>
          );
        })}
        {flatCredentials.length === 0 && (
          <Text color={inkPalette.dim}>No credentials registered in pool yet. Add via `coreblow auth`.</Text>
        )}
      </Box>

      {/* Telemetry Summary */}
      <Box borderStyle="single" borderTop borderColor={inkPalette.border} justifyContent="space-between">
        <Text color={inkPalette.dim}>
          Lifetime Cost: <Text bold color={inkPalette.accent}>${lifetimeCost.toFixed(4)}</Text> ({lifetimeTokens} tokens)
        </Text>
        <Text color={inkPalette.dim}>
          <Text bold color={inkPalette.text}>Enter</Text>: Toggle · <Text bold color={inkPalette.text}>c</Text>: Reset Cooldowns · <Text bold color={inkPalette.text}>d</Text>: Delete · <Text bold color={inkPalette.text}>Esc</Text>: Close
        </Text>
      </Box>
    </Box>
  );
};
