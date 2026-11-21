import React from "react";
import { Box, Text } from "ink";
import process from "node:process";
import { inkPalette } from "./theme.js";

export interface WelcomeHeroProps {
  model: string;
  uiMode: "basic" | "pro";
  backendBadge: string;
  columns?: number;
}

const QUICK_COMMANDS = [
  { cmd: "/model", label: "Switch model" },
  { cmd: "/sessions", label: "Resume session" },
  { cmd: "/pool", label: "Keys & agents" },
  { cmd: "/help", label: "Commands & tips" },
];

export const WelcomeHero: React.FC<WelcomeHeroProps> = ({
  model,
  uiMode,
  backendBadge,
  columns = process.stdout.columns || 80,
}) => {
  const modelShortName = model.split("/").pop() || model;
  const isHealthy = backendBadge === "Local" || backendBadge.includes("18789");

  const isWide = columns >= 84;
  const isMedium = columns >= 64 && columns < 84;
  const isNarrow = columns < 64;

  return (
    <Box
      flexGrow={1}
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      paddingY={1}
    >
      {/* 1. Geometric Emblem + Wordmark */}
      {columns >= 68 ? (
        <Box flexDirection="row" alignItems="center" marginY={1}>
          <Box flexDirection="column" marginRight={2}>
            <Text color={inkPalette.accent}> ▄████▄ </Text>
            <Text color={inkPalette.accent}>
              ██<Text color={inkPalette.text}>  ▀▀</Text>
            </Text>
            <Text color={inkPalette.accent}> ▀████▀ </Text>
          </Box>
          <Box flexDirection="column">
            <Box>
              <Text bold color={inkPalette.text}>
                CORE
              </Text>
              <Text bold color={inkPalette.accent}>
                BLOW
              </Text>
            </Box>
            <Box>
              <Text color={inkPalette.accent}>── </Text>
              <Text color={inkPalette.dim}>AI Development CLI</Text>
              <Text color={inkPalette.accent}> ──</Text>
            </Box>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column" alignItems="center" marginY={1}>
          <Box>
            <Text color={inkPalette.accent}>◆ </Text>
            <Text bold color={inkPalette.text}>
              CORE
            </Text>
            <Text bold color={inkPalette.accent}>
              BLOW
            </Text>
          </Box>
          <Text color={inkPalette.dim}>AI Development CLI</Text>
        </Box>
      )}

      {/* 2. Centered Status Pill */}
      <Box
        borderStyle="round"
        borderColor={inkPalette.border}
        paddingX={2}
        marginY={1}
      >
        <Text color={inkPalette.dim}>◈ </Text>
        <Text color={inkPalette.text}>{modelShortName}</Text>
        <Text color={inkPalette.border}>  │  </Text>
        <Text color={inkPalette.dim}>▤ </Text>
        <Text color={inkPalette.text}>{uiMode}</Text>
        <Text color={inkPalette.border}>  │  </Text>
        <Text color={inkPalette.dim}>⚙ </Text>
        <Text color={inkPalette.text}>{backendBadge}</Text>
        <Text color={inkPalette.border}>  │  </Text>
        <Text color={isHealthy ? inkPalette.success : inkPalette.error}>● </Text>
        <Text color={isHealthy ? inkPalette.success : inkPalette.dim}>
          {isHealthy ? "stable" : "offline"}
        </Text>
      </Box>

      {/* 3. 4-Column Symmetrical Quick-Command Strip */}
      {isWide && (
        <Box flexDirection="row" alignItems="center" marginY={1}>
          {QUICK_COMMANDS.map((c, i) => (
            <React.Fragment key={c.cmd}>
              {i > 0 && (
                <Box marginX={1}>
                  <Text color={inkPalette.border}>│</Text>
                </Box>
              )}
              <Box flexDirection="column" alignItems="center" marginX={1}>
                <Box
                  borderStyle="round"
                  borderColor={inkPalette.accent}
                  paddingX={1}
                >
                  <Text bold color={inkPalette.accent}>
                    {c.cmd}
                  </Text>
                </Box>
                <Text color={inkPalette.dim}>{c.label}</Text>
              </Box>
            </React.Fragment>
          ))}
        </Box>
      )}

      {isMedium && (
        <Box flexDirection="row" alignItems="center" marginY={1}>
          {QUICK_COMMANDS.map((c, i) => (
            <React.Fragment key={c.cmd}>
              {i > 0 && (
                <Box marginX={1}>
                  <Text color={inkPalette.border}>│</Text>
                </Box>
              )}
              <Box flexDirection="column" alignItems="center" marginX={1}>
                <Text bold color={inkPalette.accent}>
                  [ {c.cmd} ]
                </Text>
                <Text color={inkPalette.dim}>{c.label}</Text>
              </Box>
            </React.Fragment>
          ))}
        </Box>
      )}

      {isNarrow && (
        <Box flexDirection="column" alignItems="center" marginY={1}>
          <Box flexDirection="row" justifyContent="center">
            <Box flexDirection="column" alignItems="center" marginX={2}>
              <Text bold color={inkPalette.accent}>
                [ {QUICK_COMMANDS[0]!.cmd} ]
              </Text>
              <Text color={inkPalette.dim}>{QUICK_COMMANDS[0]!.label}</Text>
            </Box>
            <Box flexDirection="column" alignItems="center" marginX={2}>
              <Text bold color={inkPalette.accent}>
                [ {QUICK_COMMANDS[1]!.cmd} ]
              </Text>
              <Text color={inkPalette.dim}>{QUICK_COMMANDS[1]!.label}</Text>
            </Box>
          </Box>
          <Box flexDirection="row" justifyContent="center" marginTop={1}>
            <Box flexDirection="column" alignItems="center" marginX={2}>
              <Text bold color={inkPalette.accent}>
                [ {QUICK_COMMANDS[2]!.cmd} ]
              </Text>
              <Text color={inkPalette.dim}>{QUICK_COMMANDS[2]!.label}</Text>
            </Box>
            <Box flexDirection="column" alignItems="center" marginX={2}>
              <Text bold color={inkPalette.accent}>
                [ {QUICK_COMMANDS[3]!.cmd} ]
              </Text>
              <Text color={inkPalette.dim}>{QUICK_COMMANDS[3]!.label}</Text>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};
