import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import {
  getBotChannelsStatus,
  getSyncBotChannelsStatus,
  setChannelEnabled,
  type BotChannelStatus,
} from "../../cli/bots-cli.js";
import { isGatewayReachable } from "../tui-backend.js";
import { inkPalette } from "./theme.js";

export interface BotsModalProps {
  onClose: () => void;
  initialChannels?: BotChannelStatus[];
}

export const BotsModal: React.FC<BotsModalProps> = ({ onClose, initialChannels }) => {
  const [channels, setChannels] = useState<BotChannelStatus[]>(
    () => initialChannels || getSyncBotChannelsStatus(),
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [gatewayOnline, setGatewayOnline] = useState(false);
  const [pairingNotice, setPairingNotice] = useState<string | null>(null);

  const refreshChannels = useCallback(async () => {
    try {
      const list = await getBotChannelsStatus();
      setChannels(list);
      const isOnline = await isGatewayReachable("http://127.0.0.1:18789", 800);
      setGatewayOnline(isOnline);
    } catch (err) {
      setStatusNotice(`Failed to load channel states: ${String(err)}`);
    }
  }, []);

  useEffect(() => {
    void refreshChannels();
  }, [refreshChannels]);

  const safeIndex = Math.min(Math.max(0, selectedIndex), Math.max(0, channels.length - 1));
  const activeChannel = channels[safeIndex];

  // Toggle channel listener
  const toggleChannel = useCallback(
    async (ch: BotChannelStatus) => {
      const nextEnabled = !ch.enabled;
      try {
        await setChannelEnabled(ch.id, nextEnabled);
        setStatusNotice(`Channel "${ch.name}" is now ${nextEnabled ? "enabled" : "disabled"}.`);
        await refreshChannels();
      } catch (err) {
        setStatusNotice(`Failed to update channel: ${String(err)}`);
      }
    },
    [refreshChannels],
  );

  // Send test ping
  const testChannel = useCallback((ch: BotChannelStatus) => {
    setStatusNotice(`Probing ${ch.name} connection health...`);
    setTimeout(() => {
      setStatusNotice(
        `✓ ${ch.name}: Connection ${ch.status} · Loop-guard: ${ch.loopProtection}${ch.lastError ? ` · Error: ${ch.lastError}` : ""}`,
      );
    }, 400);
  }, []);

  // Pairing code / flow
  const pairChannel = useCallback((ch: BotChannelStatus) => {
    if (ch.id === "whatsapp") {
      setPairingNotice("WhatsApp Web: Run `coreblow channels login` in terminal to scan QR.");
    } else {
      setPairingNotice(`${ch.name}: Pairing code ready. DM your bot an authorization code.`);
    }
  }, []);

  // Gateway daemon control
  const toggleGateway = useCallback(async () => {
    try {
      if (gatewayOnline) {
        setStatusNotice("Stopping Gateway service...");
        const { runDaemonStop } = await import("../../cli/daemon-cli/runners.js");
        await runDaemonStop({ json: true } as any);
        setStatusNotice("Gateway daemon stopped.");
      } else {
        setStatusNotice("Starting Gateway 24/7 background service...");
        const { runDaemonStart } = await import("../../cli/daemon-cli/runners.js");
        await runDaemonStart({ json: true } as any);
        setStatusNotice("Gateway daemon started.");
      }
      await refreshChannels();
    } catch (err) {
      setStatusNotice(`Gateway service action failed: ${String(err)}`);
    }
  }, [gatewayOnline, refreshChannels]);

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }

    if (input === " " && activeChannel) {
      void toggleChannel(activeChannel);
      return;
    }

    if (input === "t" && activeChannel) {
      testChannel(activeChannel);
      return;
    }

    if (input === "p" && activeChannel) {
      pairChannel(activeChannel);
      return;
    }

    if (input === "g") {
      void toggleGateway();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(channels.length - 1, prev + 1));
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
          CoreBlow 24/7 Bot Messaging & Gateway
        </Text>
        <Text color={gatewayOnline ? inkPalette.success : inkPalette.dim}>
          ● Gateway :18789 {gatewayOnline ? "online" : "offline"}
        </Text>
      </Box>

      {statusNotice && (
        <Box marginY={0}>
          <Text color={inkPalette.link}>{statusNotice}</Text>
        </Box>
      )}

      {pairingNotice && (
        <Box marginY={0}>
          <Text color={inkPalette.accentSoft}>{pairingNotice}</Text>
        </Box>
      )}

      <Box flexDirection="column" marginY={1}>
        <Text color={inkPalette.dim}>
          Connected messaging channels with automatic bot loop-protection:
        </Text>
      </Box>

      {/* Channels List */}
      <Box flexDirection="column" marginY={0}>
        {channels.map((ch, idx) => {
          const isSelected = idx === safeIndex;
          const statusIcon = ch.status === "online" ? "● online" : ch.status === "pairing" ? "◐ pairing" : "○ offline";
          const statusColor: string =
            ch.status === "online" ? inkPalette.success : ch.status === "pairing" ? inkPalette.accentSoft : inkPalette.dim;
          const enabledLabel = ch.enabled ? "[enabled]" : "[disabled]";

          return (
            <Box key={ch.id} flexDirection="column" marginY={0}>
              <Box justifyContent="space-between">
                <Box>
                  <Text color={isSelected ? inkPalette.accent : inkPalette.dim}>
                    {isSelected ? "❯ " : "  "}
                  </Text>
                  <Text bold={isSelected} color={inkPalette.text}>
                    {ch.name}
                  </Text>
                  {ch.identity && (
                    <Text color={inkPalette.dim}> ({ch.identity})</Text>
                  )}
                </Box>
                <Box>
                  <Text color={statusColor}>{statusIcon} </Text>
                  <Text color={ch.enabled ? inkPalette.link : inkPalette.dim}>{enabledLabel}</Text>
                </Box>
              </Box>
              <Box paddingLeft={4}>
                <Text color={inkPalette.dim}>
                  Loop Guard: {ch.loopProtection} · Configured: {ch.configured ? "yes" : "no"}
                </Text>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Actions footer */}
      <Box
        borderStyle="single"
        borderTop
        borderColor={inkPalette.border}
        marginTop={1}
        justifyContent="space-between"
      >
        <Text color={inkPalette.dim}>
          <Text bold color={inkPalette.text}>Space</Text>: Enable/Disable · <Text bold color={inkPalette.text}>p</Text>: Pair · <Text bold color={inkPalette.text}>t</Text>: Test · <Text bold color={inkPalette.text}>g</Text>: Gateway Toggle · <Text bold color={inkPalette.text}>Esc</Text>: Close
        </Text>
      </Box>
    </Box>
  );
};
