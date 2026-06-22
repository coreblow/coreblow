import fs from "node:fs/promises";
import { pathExists, resolvePathWithinRoot } from "coreblow/plugin-sdk/security-runtime";
import type { VoiceCallConfig } from "./config.js";
import type { CoreAgentDeps, CoreConfig } from "./core-bridge.js";
import { COREBLOW_REALTIME_AGENT_CONSULT_TOOL_NAME } from "./realtime-defaults.js";

type AgentEntryLike = {
  id?: unknown;
  systemPromptOverride?: unknown;
};

type VoiceIdentityLike = {
  name?: unknown;
  emoji?: unknown;
  theme?: unknown;
  creature?: unknown;
  vibe?: unknown;
};

function normalizeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readAgentEntries(cfg: CoreConfig): AgentEntryLike[] {
  const agents = (cfg as { agents?: { list?: unknown } }).agents;
  return Array.isArray(agents?.list)
    ? agents.list.filter((entry): entry is AgentEntryLike =>
        Boolean(entry && typeof entry === "object"),
      )
    : [];
}

function resolveAgentSystemPromptOverride(cfg: CoreConfig, agentId: string): string | undefined {
  const entries = readAgentEntries(cfg);
  const entry = entries.find((candidate) => normalizeString(candidate.id) === agentId);
  return (
    normalizeString(entry?.systemPromptOverride) ??
    normalizeString(
      (cfg as { agents?: { defaults?: { systemPromptOverride?: unknown } } }).agents?.defaults
        ?.systemPromptOverride,
    )
  );
}

function limitText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxChars - 32)).trimEnd()}\n[truncated]`;
}

function buildRealtimeVoiceAgentConsultPolicyInstructions(config: VoiceCallConfig["realtime"]): string {
  switch (config.consultPolicy) {
    case "always":
      return `Consult behavior:\nCall ${COREBLOW_REALTIME_AGENT_CONSULT_TOOL_NAME} before every non-trivial answer.`;
    case "substantive":
      return `Consult behavior:\nCall ${COREBLOW_REALTIME_AGENT_CONSULT_TOOL_NAME} before answering requests that need deeper reasoning, tools, or current information.`;
    default:
      return `Consult behavior:\nCall ${COREBLOW_REALTIME_AGENT_CONSULT_TOOL_NAME} when the caller needs tools, fresher context, or more reasoning than a fast spoken reply should carry.`;
  }
}

async function readWorkspaceVoiceContextFiles(params: {
  workspaceDir: string;
  files: readonly string[];
  maxChars: number;
}): Promise<string[]> {
  const sections: string[] = [];
  let remaining = params.maxChars;
  for (const file of params.files) {
    if (remaining <= 0) {
      continue;
    }
    const resolved = resolvePathWithinRoot({
      rootDir: params.workspaceDir,
      requestedPath: file,
      scopeLabel: "agent workspace",
    });
    if (!resolved.ok) {
      continue;
    }
    if (!(await pathExists(resolved.path))) {
      continue;
    }
    const content = await fs.readFile(resolved.path, "utf8").catch(() => undefined);
    const trimmed = content?.trim();
    if (!trimmed) {
      continue;
    }
    const body = limitText(trimmed, Math.max(0, remaining - file.length - 16));
    const section = `### ${file}\n${body}`;
    sections.push(section);
    remaining -= section.length;
  }
  return sections;
}

export async function buildRealtimeVoiceInstructions(params: {
  baseInstructions: string;
  config: VoiceCallConfig;
  coreConfig: CoreConfig;
  agentRuntime: CoreAgentDeps;
}): Promise<string> {
  const { config } = params;
  const sections: string[] = [params.baseInstructions];
  sections.push(buildRealtimeVoiceAgentConsultPolicyInstructions(config.realtime));

  const contextConfig = config.realtime.agentContext;
  if (!contextConfig.enabled) {
    return sections.filter(Boolean).join("\n\n");
  }

  const agentId = config.agentId ?? "main";
  const capsule: string[] = [
    "CoreBlow agent voice context:",
    `- Agent id: ${agentId}`,
    "- Use this context to match the CoreBlow agent's personality and standing preferences on fast voice turns.",
    `- Treat this as compact context only; call ${COREBLOW_REALTIME_AGENT_CONSULT_TOOL_NAME} when the caller needs the full agent brain, tools, memory, or workspace state.`,
  ];

  if (contextConfig.includeIdentity) {
    const identity = params.agentRuntime.resolveAgentIdentity?.(
      params.coreConfig as never,
      agentId,
    ) as VoiceIdentityLike | undefined;
    const identityLines = [
      normalizeString(identity?.name) ? `- Name: ${normalizeString(identity?.name)}` : undefined,
      normalizeString(identity?.emoji) ? `- Emoji: ${normalizeString(identity?.emoji)}` : undefined,
      normalizeString(identity?.vibe) ? `- Vibe: ${normalizeString(identity?.vibe)}` : undefined,
      normalizeString(identity?.theme) ? `- Theme: ${normalizeString(identity?.theme)}` : undefined,
      normalizeString(identity?.creature)
        ? `- Creature/persona: ${normalizeString(identity?.creature)}`
        : undefined,
    ].filter(Boolean);
    if (identityLines.length > 0) {
      capsule.push(`Configured identity:\n${identityLines.join("\n")}`);
    }
  }

  if (contextConfig.includeSystemPrompt) {
    const systemPrompt = resolveAgentSystemPromptOverride(params.coreConfig, agentId);
    if (systemPrompt) {
      capsule.push(`Configured system prompt override:\n${systemPrompt}`);
    }
  }

  if (contextConfig.includeWorkspaceFiles) {
    const workspaceDir = params.agentRuntime.resolveAgentWorkspaceDir?.(
      params.coreConfig as never,
      agentId,
    );
    if (workspaceDir) {
      const fileSections = await readWorkspaceVoiceContextFiles({
        workspaceDir,
        files: contextConfig.files,
        maxChars: contextConfig.maxChars,
      });
      if (fileSections.length > 0) {
        capsule.push(`Workspace voice context:\n${fileSections.join("\n\n")}`);
      }
    }
  }

  sections.push(limitText(capsule.join("\n\n"), contextConfig.maxChars));
  return sections.filter(Boolean).join("\n\n");
}
