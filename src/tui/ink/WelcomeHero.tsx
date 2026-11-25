import React from "react";
import { Box, Text } from "ink";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { VERSION } from "../../version.js";
import {
  OCTOPUS_COMPACT_GRID,
  OCTOPUS_STANDARD_GRID,
  renderPixelGridRows,
  type OctopusVariant,
} from "./pixel-octopus.js";
import { inkPalette } from "./theme.js";

const CORE_ORANGE = "#E95420";
const SLASH_COMMANDS = ["model", "sessions", "desktop", "pool", "help"] as const;

export interface WelcomeHeroProps {
  model: string;
  uiMode: "basic" | "pro";
  backendBadge: string;
  columns?: number;
  version?: string;
  cwd?: string;
}

export interface PixelOctopusProps {
  variant?: OctopusVariant;
  monochrome?: boolean;
}

/**
 * Abbreviates a workspace path cleanly with `~` when inside the home directory.
 */
export function abbreviateHomePath(
  targetPath: string = process.cwd(),
  homeDir: string = os.homedir(),
): string {
  const normalizedTarget = path.resolve(targetPath);
  const normalizedHome = path.resolve(homeDir);
  if (normalizedTarget === normalizedHome) {
    return "~";
  }
  const homePrefix = normalizedHome.endsWith(path.sep)
    ? normalizedHome
    : `${normalizedHome}${path.sep}`;
  if (normalizedTarget.startsWith(homePrefix)) {
    const rel = normalizedTarget.slice(homePrefix.length).split(path.sep).join("/");
    return `~/${rel}`;
  }
  return normalizedTarget;
}

/**
 * Truncates long paths from the middle so both root context and repo leaf remain readable.
 */
export function truncateDisplayPath(displayPath: string, maxWidth: number): string {
  if (maxWidth <= 4 || displayPath.length <= maxWidth) {
    return displayPath;
  }
  const lead = displayPath.startsWith("~/") ? "~/" : "";
  const body = lead ? displayPath.slice(2) : displayPath;
  const available = maxWidth - lead.length - 1;
  if (available <= 4) {
    return `${displayPath.slice(0, Math.max(1, maxWidth - 1))}…`;
  }
  return `${lead}…${body.slice(-available)}`;
}

export const PixelOctopus: React.FC<PixelOctopusProps> = ({
  variant = "standard",
  monochrome,
}) => {
  const grid = variant === "standard" ? OCTOPUS_STANDARD_GRID : OCTOPUS_COMPACT_GRID;
  const rows = renderPixelGridRows(grid, monochrome === undefined ? {} : { monochrome });

  return (
    <Box flexDirection="column" flexShrink={0}>
      {rows.map((segments, rowIndex) => (
        <Box key={`octo-row-${rowIndex}`} flexDirection="row">
          <Text>
            {segments.map((seg, segIndex) => (
              <Text
                key={`octo-seg-${rowIndex}-${segIndex}`}
                {...(seg.color ? { color: seg.color } : {})}
                {...(seg.backgroundColor ? { backgroundColor: seg.backgroundColor } : {})}
              >
                {seg.char}
              </Text>
            ))}
          </Text>
        </Box>
      ))}
    </Box>
  );
};

function SlashCommandInlineList({ commands }: { commands: readonly string[] }) {
  return (
    <Text>
      {commands.map((name, index) => (
        <React.Fragment key={name}>
          {index > 0 && <Text color={inkPalette.dim}> · </Text>}
          <Text bold color={CORE_ORANGE}>
            /
          </Text>
          <Text color={inkPalette.text}>{name}</Text>
        </React.Fragment>
      ))}
    </Text>
  );
}

export const WelcomeHero: React.FC<WelcomeHeroProps> = ({
  model,
  uiMode,
  backendBadge,
  columns = process.stdout.columns || 80,
  version = VERSION,
  cwd = process.cwd(),
}) => {
  const normalizedVersion = version.replace(/^v/i, "");
  const modelShortName = model.split("/").pop() || model;
  const isHealthy = backendBadge === "Local" || backendBadge.includes("18789");
  const variant: OctopusVariant = columns >= 72 ? "standard" : "compact";
  const mascotWidth = variant === "standard" ? 16 : 12;
  const rightColBudget = Math.max(20, columns - mascotWidth - 5);
  const displayCwd = truncateDisplayPath(abbreviateHomePath(cwd), rightColBudget);
  const isNarrow = columns < 64;

  return (
    <Box flexDirection="row" alignItems="center" paddingX={1} paddingY={1}>
      <Box marginRight={2} flexShrink={0}>
        <PixelOctopus variant={variant} />
      </Box>

      <Box flexDirection="column" flexShrink={1}>
        <Box>
          <Text bold color={inkPalette.text}>
            CoreBlow
          </Text>
          <Text color={inkPalette.dim}> v{normalizedVersion}</Text>
        </Box>

        <Box>
          <Text color={inkPalette.text}>{modelShortName}</Text>
          <Text color={inkPalette.dim}>
            {" "}
            · {backendBadge} · {uiMode}{" "}
          </Text>
          <Text color={isHealthy ? inkPalette.success : inkPalette.error}>●</Text>
        </Box>

        <Box>
          <Text color={inkPalette.dim}>{displayCwd}</Text>
        </Box>

        <Box flexDirection="column">
          {isNarrow ? (
            <>
              <SlashCommandInlineList commands={SLASH_COMMANDS.slice(0, 3)} />
              <SlashCommandInlineList commands={SLASH_COMMANDS.slice(3)} />
            </>
          ) : (
            <SlashCommandInlineList commands={SLASH_COMMANDS} />
          )}
        </Box>
      </Box>
    </Box>
  );
};
