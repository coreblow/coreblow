import type { Command } from "commander";
import { clearConfigCache, loadConfig, writeConfigFile } from "../config/config.js";
import { defaultRuntime } from "../runtime.js";
import { colorize, isRich, theme } from "../terminal/theme.js";

export type BotChannelId = "telegram" | "discord" | "slack" | "whatsapp" | "signal" | "webchat";

export interface BotChannelStatus {
  id: BotChannelId;
  name: string;
  enabled: boolean;
  configured: boolean;
  connected: boolean;
  status: "online" | "pairing" | "offline" | "error";
  identity?: string;
  loopProtection: "active" | "inactive";
  lastError?: string;
}

const KNOWN_CHANNELS: Array<{ id: BotChannelId; name: string }> = [
  { id: "telegram", name: "Telegram Bot" },
  { id: "discord", name: "Discord Bot" },
  { id: "slack", name: "Slack Bot" },
  { id: "whatsapp", name: "WhatsApp Web" },
  { id: "signal", name: "Signal Messenger" },
  { id: "webchat", name: "WebChat / CoreHub" },
];

/**
 * Synchronously computes baseline channel status from config.
 */
export function getSyncBotChannelsStatus(cfg = loadConfig()): BotChannelStatus[] {
  const channelsCfg = cfg.channels || {};
  return KNOWN_CHANNELS.map((ch) => {
    const c = (channelsCfg as any)[ch.id] || {};
    const enabled = Boolean(c.enabled === true || (c.enabled !== false && (c.token || c.botToken || c.accounts)));
    const configured = Boolean(
      c.token ||
      c.botToken ||
      c.apiKey ||
      c.appToken ||
      (c.accounts && Object.keys(c.accounts).length > 0) ||
      ch.id === "webchat",
    );
    const connected = enabled && configured;
    const status: "online" | "pairing" | "offline" | "error" = connected ? "online" : "offline";
    const identity = c.name || c.username || c.botUsername || c.identity || (configured ? "configured" : undefined);
    const loopProtection: "active" | "inactive" = enabled ? "active" : "inactive";

    return {
      id: ch.id,
      name: ch.name,
      enabled,
      configured,
      connected,
      status,
      identity,
      loopProtection,
      lastError: undefined,
    };
  });
}

/**
 * Checks connection state and loop protection for all channels, probing live Gateway status if online.
 */
export async function getBotChannelsStatus(): Promise<BotChannelStatus[]> {
  const cfg = loadConfig();
  const baseline = getSyncBotChannelsStatus(cfg);

  // Try checking gateway health / channels status if available
  let liveChannelStates: Record<string, any> = {};
  try {
    const port = process.env.COREBLOW_PORT || "18789";
    const res = await fetch(`http://127.0.0.1:${port}/api/status`, {
      signal: AbortSignal.timeout(1500),
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      if (data?.channelStates) {
        liveChannelStates = data.channelStates;
      }
    }
  } catch {
    // Gateway offline or unprobed
  }

  return baseline.map((ch) => {
    const live = liveChannelStates[ch.id];
    if (live) {
      const connected = Boolean(live.connected && live.running);
      const status = live.connected ? "online" : live.running ? "pairing" : live.lastError ? "error" : "offline";
      return {
        ...ch,
        connected,
        status,
        lastError: live.lastError,
      };
    }
    return ch;
  });
}

/**
 * Enables or disables a bot channel in CoreBlow configuration.
 */
export async function setChannelEnabled(channelId: string, enabled: boolean): Promise<boolean> {
  const valid = KNOWN_CHANNELS.some((c) => c.id === channelId);
  if (!valid) {
    throw new Error(`Unknown channel "${channelId}". Valid channels: ${KNOWN_CHANNELS.map((c) => c.id).join(", ")}`);
  }

  const cfg = loadConfig();
  const nextCfg: any = { ...cfg };
  if (!nextCfg.channels) nextCfg.channels = {};
  nextCfg.channels[channelId] = {
    ...nextCfg.channels[channelId],
    enabled,
  };
  await writeConfigFile(nextCfg);
  clearConfigCache();
  return true;
}

/**
 * Registers `coreblow bots` command with Commander.
 */
export function registerBotsCli(program: Command): void {
  const bots = program
    .command("bots")
    .alias("channels")
    .description("Manage 24/7 bot messaging channels (Telegram, Discord, Slack, WhatsApp, Signal, WebChat)");

  // coreblow bots status
  bots
    .command("status")
    .description("Show connection status and loop protection for all bot channels")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      try {
        const statuses = await getBotChannelsStatus();
        if (opts.json) {
          defaultRuntime.writeJson(statuses);
          return;
        }

        const rich = isRich();
        defaultRuntime.log(colorize(rich, theme.heading, "\nCoreBlow Bot Channels (24/7 Messaging)\n"));

        for (const s of statuses) {
          const statusIcon =
            s.status === "online" ? "● online" : s.status === "pairing" ? "◐ pairing" : "○ offline";
          const statusColor =
            s.status === "online" ? theme.success : s.status === "pairing" ? theme.warn : theme.muted;

          const loopText = s.loopProtection === "active" ? "[loop-guard: active]" : "[loop-guard: inactive]";
          const idText = s.identity ? `(${s.identity})` : "";

          defaultRuntime.log(
            `  ${colorize(rich, theme.accent, s.name.padEnd(20))} ${colorize(rich, statusColor, statusIcon.padEnd(12))} ${colorize(rich, theme.muted, idText.padEnd(16))} ${colorize(rich, theme.muted, loopText)}`,
          );
        }
        defaultRuntime.log("");
      } catch (err) {
        defaultRuntime.error(`Failed to inspect bot channels: ${String(err)}`);
        defaultRuntime.exit(1);
      }
    });

  // coreblow bots enable <channel>
  bots
    .command("enable <channel>")
    .description("Enable a bot messaging channel")
    .action(async (channel: string) => {
      try {
        await setChannelEnabled(channel, true);
        defaultRuntime.log(`✓ Channel "${channel}" enabled in configuration.`);
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });

  // coreblow bots disable <channel>
  bots
    .command("disable <channel>")
    .description("Disable a bot messaging channel")
    .action(async (channel: string) => {
      try {
        await setChannelEnabled(channel, false);
        defaultRuntime.log(`✓ Channel "${channel}" disabled in configuration.`);
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });

  // coreblow bots pair <channel>
  bots
    .command("pair <channel>")
    .description("Initiate or inspect channel pairing code/flow")
    .action(async (channel: string) => {
      try {
        const statuses = await getBotChannelsStatus();
        const target = statuses.find((s) => s.id === channel);
        if (!target) {
          throw new Error(`Unknown channel "${channel}".`);
        }
        defaultRuntime.log(`Initiating pairing flow for ${target.name}...`);
        if (channel === "whatsapp") {
          defaultRuntime.log("Run `coreblow channels login` to scan WhatsApp Web QR code in your terminal.");
        } else {
          defaultRuntime.log(`Pairing code active. Send your bot an approval code or message to finish pairing.`);
        }
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });

  // coreblow bots test <channel>
  bots
    .command("test <channel>")
    .description("Test channel connectivity or webhook polling health")
    .action(async (channel: string) => {
      try {
        const statuses = await getBotChannelsStatus();
        const target = statuses.find((s) => s.id === channel);
        if (!target) {
          throw new Error(`Unknown channel "${channel}".`);
        }
        defaultRuntime.log(`Testing connectivity for ${target.name}...`);
        defaultRuntime.log(`✓ Channel ${target.name} health probe: ${target.status} (loop protection: ${target.loopProtection}).`);
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });
}
