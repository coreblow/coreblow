import { runCoreBlowReActLoop } from "../../agents/coreblow-react-engine.js";

export type WarRoomRole = "lead" | "coder" | "researcher" | "auditor" | "verifier" | "all";

export interface SquadMentionParseResult {
  isSquad: boolean;
  role?: WarRoomRole;
  cleanPrompt: string;
}

export interface WarRoomTurnResult {
  ok: boolean;
  role: WarRoomRole;
  response: string;
  source: "gateway" | "local_coordinator";
  steps?: string[];
  error?: string;
}

const SQUAD_ROLES = new Set<WarRoomRole>(["lead", "coder", "researcher", "auditor", "verifier", "all"]);

const SPECIALIST_PERSONAS: Record<Exclude<WarRoomRole, "all">, string> = {
  lead: "You are @lead: CoreBlow Lead Architect & Orchestrator. Provide high-level technical direction, division of labor, and architectural synthesis.",
  coder: "You are @coder: CoreBlow Implementation Specialist. Write precise, production-grade TypeScript code, shortest diffs, and exact fixes.",
  researcher: "You are @researcher: CoreBlow Documentation & Investigation Analyst. Search dependencies, discover module contracts, and verify interfaces.",
  auditor: "You are @auditor: CoreBlow Security & Vulnerability Auditor. Audit permissions, verify memory barriers, and enforce security policies.",
  verifier: "You are @verifier: CoreBlow Test & Verification Gatekeeper. Run tests non-interactively, verify gate counts, and report landing readiness.",
};

/**
 * Detects if a prompt mentions one of the War Room squad specialists.
 */
export function parseSquadMention(input: string): SquadMentionParseResult {
  const trimmed = input.trim();
  const match = /^@(lead|coder|researcher|auditor|verifier|all)\b(?::|\s+)?(.*)$/i.exec(trimmed);

  if (match) {
    const roleRaw = match[1]!.toLowerCase() as WarRoomRole;
    if (SQUAD_ROLES.has(roleRaw)) {
      return {
        isSquad: true,
        role: roleRaw,
        cleanPrompt: (match[2] || "").trim() || trimmed,
      };
    }
  }

  // Also check for embedded @squad mention
  for (const r of SQUAD_ROLES) {
    const regex = new RegExp(`@${r}\\b`, "i");
    if (regex.test(trimmed)) {
      return {
        isSquad: true,
        role: r,
        cleanPrompt: trimmed.replace(regex, "").replace(/\s{2,}/g, " ").trim(),
      };
    }
  }

  return {
    isSquad: false,
    cleanPrompt: trimmed,
  };
}

/**
 * Executes a turn targeted at a War Room specialist or entire squad.
 */
export async function executeWarRoomTurn(params: {
  role: WarRoomRole;
  prompt: string;
  sessionId?: string;
  gatewayUrl?: string;
  fetchFn?: typeof fetch;
  cwd?: string;
}): Promise<WarRoomTurnResult> {
  const fetcher = params.fetchFn ?? fetch;
  const gwUrl = params.gatewayUrl ?? "http://127.0.0.1:18789";

  // 1. Try Gateway War Room API if online
  try {
    const delegateRes = await fetcher(`${gwUrl}/api/corehub/warroom/delegate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: params.sessionId || "default_warroom",
        prompt: `[@${params.role}] ${params.prompt}`,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (delegateRes.ok) {
      const data = (await delegateRes.json()) as any;
      if (data && (data.reply || data.response)) {
        return {
          ok: true,
          role: params.role,
          response: `[@${params.role}] ${data.reply || data.response}`,
          source: "gateway",
          steps: data.toolSteps || [],
        };
      }
    }
  } catch {
    // Gateway offline, fall back to local specialist coordinator
  }

  // 2. Local Specialist Coordinator Fallback
  if (params.role === "all") {
    // Run lead coordinator synthesis
    const leadPrompt = `War Room Squad Broadcast: "${params.prompt}". Coordinate action items across @coder, @researcher, @auditor, and @verifier.`;
    const res = await runCoreBlowReActLoop({
      prompt: leadPrompt,
      sessionId: params.sessionId,
      defaultCwd: params.cwd || process.cwd(),
    });

    return {
      ok: res.ok,
      role: "all",
      response: `[War Room Squad · @all]\n${res.reply || res.error || "No response received."}`,
      source: "local_coordinator",
      steps: res.toolSteps,
      error: res.error,
    };
  }

  const persona = SPECIALIST_PERSONAS[params.role];
  const directedPrompt = `${persona}\n\nTask: ${params.prompt}`;

  const res = await runCoreBlowReActLoop({
    prompt: directedPrompt,
    sessionId: params.sessionId,
    defaultCwd: params.cwd || process.cwd(),
  });

  return {
    ok: res.ok,
    role: params.role,
    response: `[@${params.role}]\n${res.reply || res.error || "No response received."}`,
    source: "local_coordinator",
    steps: res.toolSteps,
    error: res.error,
  };
}
