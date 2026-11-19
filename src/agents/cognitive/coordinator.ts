/**
 * src/agents/cognitive/coordinator.ts
 *
 * CognitiveCoordinator — Single-Brain Cognitive Lifecycle Facade for CoreBlow.
 * Bridges the real execution turn loop (src/agents/pi-embedded-runner)
 * with the 12-Service Microkernel:
 *  - Cory 4-Layer Memory (retrieval + persistence)
 *  - Cory EvoLoop (active skill prompt injection, trajectory ingest, outcome tracking)
 *  - Decision Router (adaptive tier routing with active credential guardrail)
 *  - Knowledge Scribe (decision & wiki note capture, prepared zero-stall compaction)
 *  - Bounded async background task queue with graceful drain on gateway close
 *  - Telemetry counters for full observability
 */

import type { CoreBlowConfig } from "../../config/config.js";
import { getActiveMicrokernel, type MicrokernelServicesResult } from "../../gateway/microkernel-services.js";
import {
  evaluatePreLlmCallHook,
  type EvaluatePreLlmCallHookResult,
  type EvolvingSkillRecord,
  type TrajectoryToolStep,
  type TurnTrajectoryRecord,
} from "../../learning/index.js";
import {
  type CoryMemoryItem,
  type CoryScope,
  type CoryTrustZone,
  prepareZeroStallCompaction,
  type PreparedCompactionArtifact,
  extractDialecticSignals,
  getGlobalDialecticUserModel,
  getGlobalMemoryProposalStore,
  unifiedHybridRecall,
} from "../../memory/index.js";
import {
  classifyTaskRouteTier,
  resolveAdaptiveModelRoute,
  type SubagentRouteTier,
} from "../../providers/decision-router.js";
import { createChildLogger } from "../../utils/logger.js";
import { getGlobalAuditLogger } from "../../security/audit-logger.js";
import { getGlobalWalSessionLedger } from "../../infra/storage/wal-session-ledger.js";

const log = createChildLogger("cognitive-coordinator");

function normalizeTrustZone(zone?: string): CoryTrustZone | undefined {
  if (zone === "operator" || zone === "authenticated" || zone === "public") return zone;
  if (zone === "internal" || zone === "trusted_partner") return "authenticated";
  return undefined;
}

export type { TrajectoryToolStep };

// ─── Telemetry Contracts ──────────────────────────────────────────

export interface CognitiveTelemetryCounters {
  turnsTotal: number;
  memoryInjected: number;
  skillsInjected: number;
  evoloopTrajectories: number;
  evoloopOutcomes: number;
  scribeNotes: number;
  compactionsPrepared: number;
  warroomEscalated: number;
  decisionRouterTiers: Record<SubagentRouteTier, number>;
  degradedErrors: number;
}

// ─── Turn Lifecycle Interfaces ────────────────────────────────────

export interface CognitiveTurnStartParams {
  readonly runId: string;
  readonly sessionId: string;
  readonly sessionKey?: string;
  readonly prompt: string;
  readonly requestedProvider: string;
  readonly requestedModel: string;
  readonly config?: CoreBlowConfig;
  readonly trustZone?: string;
  readonly workspaceDir?: string;
  readonly executeWarRoom?: boolean;
}

export interface CognitiveTurnStartResult {
  readonly effectiveProvider: string;
  readonly effectiveModel: string;
  readonly tier: SubagentRouteTier;
  readonly daybreakSwitched: boolean;
  readonly reason: string;
  readonly warRoomEscalated?: boolean;
  readonly warRoomId?: string;
  readonly delegatedAgentId?: string;
}

export interface CognitiveContextAssemblyParams {
  readonly prompt: string;
  readonly sessionKey?: string;
  readonly workspaceDir?: string;
  readonly userScope?: string;
  readonly trustZone?: string;
}

export interface CognitiveContextAssemblyResult {
  readonly memoryBlock?: string;
  readonly skillsBlock?: string;
  readonly matchedSkills: readonly EvolvingSkillRecord[];
  readonly activeConstraints: readonly string[];
}

export interface CognitiveTurnEndParams {
  readonly runId: string;
  readonly sessionId: string;
  readonly userGoal: string;
  readonly steps: readonly TrajectoryToolStep[];
  readonly finalOutcome: "success" | "failure" | "aborted";
  readonly trustZone?: string;
  readonly isPublicChannel?: boolean;
  readonly workspaceId?: string;
  readonly userScope?: string;
  readonly userCorrectionText?: string;
  readonly skillsInvoked?: readonly string[];
  readonly durableDecisions?: readonly string[];
  readonly durableConstraints?: readonly string[];
}

// ─── Coordinator Class ───────────────────────────────────────────

/**
 * Pure DOP complexity classifier to determine if a prompt requires War Room escalation (TB2.4).
 * Single tasks run in fast single-agent mode; multi-file refactors, security audits,
 * and multi-role instructions escalate to the War Room.
 */
export function isComplexMultiAgentTask(prompt: string): boolean {
  const text = prompt.toLowerCase();
  if (
    text.includes("war room") ||
    text.includes("warroom") ||
    text.includes("multi-agent") ||
    text.includes("multi agent") ||
    text.includes("coordinate specialist") ||
    text.includes("audit and fix") ||
    text.includes("audit dan perbaiki") ||
    text.includes("research then implement") ||
    text.includes("investigate and patch")
  ) {
    return true;
  }
  const complexPatterns = [
    /\b(?:architectural|architecture)\s+(?:refactor|migration|overhaul)\b/,
    /\b(?:security|vulnerability)\s+(?:audit|assessment|scan)\b/,
    /\bmulti-file\s+(?:refactor|editing|patch)\b/,
  ];
  return complexPatterns.some((pattern) => pattern.test(text));
}

export class CognitiveCoordinator {
  private readonly counters: CognitiveTelemetryCounters = {
    turnsTotal: 0,
    memoryInjected: 0,
    skillsInjected: 0,
    evoloopTrajectories: 0,
    evoloopOutcomes: 0,
    scribeNotes: 0,
    compactionsPrepared: 0,
    warroomEscalated: 0,
    decisionRouterTiers: {
      fast: 0,
      deep: 0,
      local: 0,
      coding: 0,
      vision: 0,
      decision: 0,
    },
    degradedErrors: 0,
  };

  /** In-flight background operations to await on graceful drain */
  private readonly inFlightTasks = new Set<Promise<unknown>>();

  /** Max in-flight async background tasks to prevent unbounded heap growth */
  private readonly maxInFlight = 64;

  public getCounters(): Readonly<CognitiveTelemetryCounters> {
    return {
      ...this.counters,
      decisionRouterTiers: { ...this.counters.decisionRouterTiers },
    };
  }

  /**
   * 1. onTurnStart: Resolves task route tier via pure DOP Decision Router.
   * Guardrail (TB1.7): Only routes to provider/model with active credentials in config,
   * otherwise falls back safely to user's configured requested model.
   */
  public async onTurnStart(params: CognitiveTurnStartParams): Promise<CognitiveTurnStartResult> {
    this.counters.turnsTotal += 1;
    const microkernel = getActiveMicrokernel();

    try {
      const tier = classifyTaskRouteTier(params.prompt);
      this.counters.decisionRouterTiers[tier] =
        (this.counters.decisionRouterTiers[tier] ?? 0) + 1;

      const decision = resolveAdaptiveModelRoute({
        tier,
      });

      // Audit logging (T7.10)
      try {
        getGlobalAuditLogger().commandExecuted(
          params.sessionId,
          `turn-start:${params.runId}`,
          true,
        );
      } catch {}

      // 1. War Room Escalation Gate (TB2.4)
      let warRoomEscalated = false;
      let warRoomId: string | undefined;
      let delegatedAgentId: string | undefined;

      if (microkernel?.warRoom && isComplexMultiAgentTask(params.prompt)) {
        try {
          const room = microkernel.warRoom.createWarRoom({
            title: `War Room for ${params.sessionId.slice(0, 12)}`,
            purpose: `Autonomous specialist escalation: ${params.prompt.slice(0, 100)}`,
          });
          const delegation = await microkernel.warRoom.delegateTask(room.roomId, params.prompt, {
            execute: params.executeWarRoom ?? false,
            cwd: params.workspaceDir,
          });
          warRoomEscalated = true;
          warRoomId = room.roomId;
          delegatedAgentId = delegation.delegatedToAgentId;
          this.counters.warroomEscalated += 1;
        } catch (err) {
          log.warn(`War room escalation skipped: ${String(err)}`);
        }
      }

      // 2. Check credential availability guardrail (TB1.7)
      const hasCredentials = this.isProviderConfigured(params.config, decision.providerId);
      const effectiveProvider = hasCredentials ? decision.providerId : params.requestedProvider;
      const effectiveModel = hasCredentials ? decision.modelId : params.requestedModel;
      const reason = hasCredentials
        ? decision.reason
        : `Preserved requested model '${params.requestedProvider}/${params.requestedModel}' (adaptive target '${decision.providerId}' lacks active credentials).`;

      return {
        effectiveProvider,
        effectiveModel,
        tier,
        daybreakSwitched: hasCredentials ? decision.daybreakSwitched : false,
        reason,
        ...(warRoomEscalated ? { warRoomEscalated, warRoomId, delegatedAgentId } : {}),
      };
    } catch (err) {
      this.counters.degradedErrors += 1;
      log.warn(`onTurnStart degraded: ${String(err)}`);
      return {
        effectiveProvider: params.requestedProvider,
        effectiveModel: params.requestedModel,
        tier: "fast",
        daybreakSwitched: false,
        reason: "Fallback to requested model due to turn start routing error.",
      };
    }
  }
  /**
   * 2. onContextAssembly: Retrieves memory layers and EvoLoop active skills.
   * Generates formatted prompt blocks for injection into the system prompt.
   */
  public async onContextAssembly(
    params: CognitiveContextAssemblyParams,
  ): Promise<CognitiveContextAssemblyResult> {
    const microkernel = getActiveMicrokernel();
    if (!microkernel) {
      return { matchedSkills: [], activeConstraints: [] };
    }

    let memoryBlock: string | undefined;
    let skillsBlock: string | undefined;
    const matchedSkills: EvolvingSkillRecord[] = [];
    const activeConstraints: string[] = [];

    // Memory Retrieval (Cory)
    try {
      const scope: CoryScope = {
        workspaceId: params.workspaceDir,
        userScope: params.userScope,
        trustZone: normalizeTrustZone(params.trustZone),
      };

      // 1. Immutable constraints are always pinned
      const constraints = microkernel.cory.memoryStore.listLayerItems("constraint", scope);
      for (const item of constraints) {
        activeConstraints.push(item.content);
      }
      if (constraints.length === 0 && scope.workspaceId && scope.workspaceId !== "default") {
        const defaultConstraints = microkernel.cory.memoryStore.listLayerItems("constraint");
        for (const item of defaultConstraints) {
          activeConstraints.push(item.content);
        }
      }

      const memoryLines: string[] = [];
      if (activeConstraints.length > 0) {
        memoryLines.push("### Active System Constraints & Guidelines");
        for (const c of activeConstraints) {
          memoryLines.push(`- ${c}`);
        }
      }

      // 2. Active Dialectic User Profile Traits (top non-superseded)
      const dialecticModel = getGlobalDialecticUserModel(microkernel.cory.getStateDir());
      const activeTraits = dialecticModel.getActiveTraits();
      if (activeTraits.length > 0) {
        memoryLines.push("### User Profile (Dialectic)");
        for (const t of activeTraits.slice(0, 8)) {
          memoryLines.push(`- [${t.dimension}] ${t.key}: ${t.value}`);
        }
      }

      // 3. Unified Hybrid Recall across Cory 4-Layer Memory + Dialectic + Session Store
      const hybridRecall = unifiedHybridRecall({
        query: params.prompt,
        scope,
        memoryStore: microkernel.cory.memoryStore,
        dialecticModel,
        topK: 6,
      });

      if (hybridRecall.hits.length > 0) {
        memoryLines.push("### Relevant Contextual Memories");
        for (const hit of hybridRecall.hits) {
          const tag = hit.layer ? hit.layer.toUpperCase() : hit.dimension ? hit.dimension.toUpperCase() : "MEMORY";
          memoryLines.push(`- [${tag}] ${hit.content}`);
        }
      }

      if (memoryLines.length > 0) {
        memoryBlock = `<cory_memory>\n${memoryLines.join("\n")}\n</cory_memory>`;
        this.counters.memoryInjected += 1;
      }
    } catch (err) {
      this.counters.degradedErrors += 1;
      log.warn(`onContextAssembly: memory retrieval degraded: ${String(err)}`);
    }

    // Skills Retrieval (Cory EvoLoop)
    try {
      if (microkernel.skillSynthesizer) {
        const skills = await microkernel.skillSynthesizer.matchSkillsForQuery(params.prompt, 4);
        if (skills.length > 0) {
          matchedSkills.push(...skills);
          const activePrompt = await microkernel.skillSynthesizer.buildActiveSkillsPrompt(skills);
          if (activePrompt && activePrompt.trim().length > 0) {
            skillsBlock = activePrompt.trim();
            this.counters.skillsInjected += 1;
          }
        }
      }
    } catch (err) {
      this.counters.degradedErrors += 1;
      log.warn(`onContextAssembly: skill matching degraded: ${String(err)}`);
    }

    return {
      memoryBlock,
      skillsBlock,
      matchedSkills,
      activeConstraints,
    };
  }

  /**
   * 3. preLlmCall: Pure DOP evaluation hook.
   * Validates budget, blocks critical prompt injection / secret exfiltration,
   * and sanitizes active constraints before dispatching to the model.
   */
  public preLlmCall(params: {
    prompt: string;
    trustZone?: string;
    activeConstraints?: readonly string[];
  }): EvaluatePreLlmCallHookResult {
    const result = evaluatePreLlmCallHook({
      prompt: params.prompt,
      trustZone: params.trustZone,
      activeConstraints: params.activeConstraints,
    });
    if (!result.allowed) {
      try {
        getGlobalAuditLogger().accessDenied("agent", "preLlmCall", {
          reason: result.blockedReason,
          trustZone: params.trustZone,
        });
      } catch {}
    }
    return result;
  }

  /**
   * 4. onTurnEnd: Asynchronously digests the turn trajectory into EvoLoop,
   * updates Bayesian Wilson scores for invoked skills, writes memory signals,
   * and records durable scribe decisions to the wiki.
   */
  public async onTurnEnd(params: CognitiveTurnEndParams): Promise<void> {
    const microkernel = getActiveMicrokernel();
    if (!microkernel) {
      return;
    }

    const trajectory: TurnTrajectoryRecord = {
      id: params.runId,
      userGoal: params.userGoal,
      steps: params.steps,
      finalOutcome: params.finalOutcome,
      trustZone: normalizeTrustZone(params.trustZone),
      isPublicChannel: params.isPublicChannel,
      workspaceId: params.workspaceId,
      userScope: params.userScope,
      userCorrectionText: params.userCorrectionText,
      timestampMs: Date.now(),
    };

    // Audit logging (T7.10)
    try {
      getGlobalAuditLogger().commandExecuted(
        params.sessionId,
        `turn-end:${params.runId}:${params.finalOutcome}`,
        params.finalOutcome === "success",
      );
    } catch {}

    // WAL Session Ledger append (T7.11)
    try {
      void getGlobalWalSessionLedger().append(params.sessionId, {
        eventType: "turn",
        agentId: params.userScope ?? "main",
        payload: {
          runId: params.runId,
          userGoal: params.userGoal,
          toolStepsCount: params.steps.length,
          finalOutcome: params.finalOutcome,
        },
      }).catch(() => {});
    } catch {}

    // Spawn bounded background task
    this.enqueueTask(async () => {
      // 1. EvoLoop Trajectory Ingestion & Auto-Distill / Auto-Patch
      if (microkernel.skillSynthesizer) {
        try {
          const ingestResult = await microkernel.skillSynthesizer.ingestTrajectory(trajectory, {
            syncConstraints: true,
          });
          if (ingestResult.ok) {
            this.counters.evoloopTrajectories += 1;
          }

          // Auto-distill novel multi-step procedures or auto-patch existing ones
          try {
            await microkernel.skillSynthesizer.autoDistillOrPatchFromTurn(trajectory);
          } catch {
            // Fail-open for auto-distill background task
          }

          // 2. Skill Outcome Feedback
          if (params.skillsInvoked && params.skillsInvoked.length > 0) {
            for (const skillId of params.skillsInvoked) {
              const outcome = params.finalOutcome === "success" ? "success" : "failure";
              await microkernel.skillSynthesizer.recordSkillOutcome(skillId, outcome);
              this.counters.evoloopOutcomes += 1;
            }
          }
        } catch (err) {
          this.counters.degradedErrors += 1;
          log.warn(`onTurnEnd: EvoLoop ingest degraded: ${String(err)}`);
        }
      }

      // 3. Knowledge Scribe Note Capture (if durable decisions or constraints present)
      if (
        microkernel.knowledgeScribe &&
        ((params.durableDecisions && params.durableDecisions.length > 0) ||
          (params.durableConstraints && params.durableConstraints.length > 0))
      ) {
        try {
          await microkernel.knowledgeScribe.captureScribeNote({
            sessionId: params.sessionId,
            title: `Session ${params.sessionId.slice(0, 8)} Outcomes`,
            decisions: params.durableDecisions,
            constraints: params.durableConstraints,
            insights: [params.userGoal],
            scope: {
              workspaceId: params.workspaceId,
              userScope: params.userScope,
              trustZone: normalizeTrustZone(params.trustZone),
              isPublicChannel: params.isPublicChannel,
            },
          });
          this.counters.scribeNotes += 1;
        } catch (err) {
          this.counters.degradedErrors += 1;
          log.warn(`onTurnEnd: KnowledgeScribe degraded: ${String(err)}`);
        }
      }

      // 4. Dialectic User Modeling & TrustZone Staging Queue (Phase 1 & 2)
      try {
        const stateDir = microkernel.cory.getStateDir();
        const dialecticModel = getGlobalDialecticUserModel(stateDir);
        const proposalStore = getGlobalMemoryProposalStore(stateDir);
        const isPublic = params.isPublicChannel === true || params.trustZone === "public";

        const textToAnalyze = [params.userGoal, params.userCorrectionText].filter(Boolean).join("\n");
        const signals = extractDialecticSignals({
          text: textToAnalyze,
          sessionId: params.sessionId,
        });

        if (signals.length > 0) {
          if (!isPublic) {
            // Private / Operator turn: auto-sync high-confidence signals to profile and Cory canonical layers
            for (const signal of signals) {
              dialecticModel.ingestSignal(signal);
              if (signal.confidence >= 0.8) {
                const targetLayer =
                  signal.dimension === "communication_style"
                    ? "identity"
                    : signal.dimension === "hard_constraints"
                    ? "constraint"
                    : "durable";
                microkernel.cory.memoryStore.remember({
                  layer: targetLayer,
                  content: `${signal.key}: ${signal.value}`,
                  scope: {
                    workspaceId: params.workspaceId,
                    userScope: params.userScope,
                    trustZone: normalizeTrustZone(params.trustZone),
                  },
                });
              }
            }
          } else {
            // Public / Group turn: NEVER mutate private layers directly; stage into proposal queue
            for (const signal of signals) {
              const targetLayer =
                signal.dimension === "communication_style"
                  ? "identity"
                  : signal.dimension === "hard_constraints"
                  ? "constraint"
                  : "durable";
              proposalStore.enqueueProposal({
                content: `${signal.key}: ${signal.value}`,
                targetLayer,
                dimension: signal.dimension,
                source: `public_channel:${params.sessionId}`,
              });
            }
          }
        }
      } catch (err) {
        log.warn(`onTurnEnd: dialectic extraction degraded: ${String(err)}`);
      }
    });
  }

  /**
   * 5. onCompaction: Prepares a zero-stall compaction artifact pinning the user's intent.
   */
  public onCompaction(params: {
    sessionId: string;
    messages: ReadonlyArray<{ readonly role: string; readonly content: string }>;
    toolNames: readonly string[];
    activeConstraints?: readonly string[];
  }): PreparedCompactionArtifact | null {
    const microkernel = getActiveMicrokernel();
    if (!microkernel || !microkernel.knowledgeScribe) {
      return null;
    }
    try {
      const artifact = prepareZeroStallCompaction({
        sessionId: params.sessionId,
        messages: params.messages,
        toolNames: params.toolNames,
        activeConstraints: params.activeConstraints ?? [],
      });
      this.counters.compactionsPrepared += 1;
      return artifact;
    } catch (err) {
      this.counters.degradedErrors += 1;
      log.warn(`onCompaction degraded: ${String(err)}`);
      return null;
    }
  }

  /**
   * 6. Graceful Drain: Awaits all in-flight background promises before shutdown.
   */
  public async drain(options?: { timeoutMs?: number }): Promise<void> {
    const timeoutMs = options?.timeoutMs ?? 2500;
    if (this.inFlightTasks.size === 0) {
      return;
    }

    const tasks = Array.from(this.inFlightTasks);
    log.info(`Draining ${tasks.length} cognitive background task(s) (timeout: ${timeoutMs}ms)...`);

    try {
      await getGlobalWalSessionLedger().flush();
    } catch {}

    await Promise.race([
      Promise.allSettled(tasks),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);

    this.inFlightTasks.clear();
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  private enqueueTask(fn: () => Promise<void>): void {
    if (this.inFlightTasks.size >= this.maxInFlight) {
      log.warn("Cognitive background task queue saturated; shedding oldest task.");
    }

    const task = fn().finally(() => {
      this.inFlightTasks.delete(task);
    });

    this.inFlightTasks.add(task);
  }

  private isProviderConfigured(cfg: CoreBlowConfig | undefined, providerId: string): boolean {
    if (!cfg) return false;
    const normalized = providerId.toLowerCase().trim();

    // 1. Check auth profiles
    const profiles = (cfg as any).auth?.profiles;
    if (profiles && typeof profiles === "object") {
      for (const p of Object.values(profiles)) {
        if (p && typeof p === "object" && (p as any).provider?.toLowerCase().trim() === normalized) {
          return true;
        }
      }
    }

    // 2. Check models.providers map
    const providers = (cfg as any).models?.providers;
    if (providers && typeof providers === "object") {
      if (Object.keys(providers).some((k) => k.toLowerCase().trim() === normalized)) {
        return true;
      }
    }

    return false;
  }
}

// ─── Global Singleton ─────────────────────────────────────────────

let coordinatorInstance: CognitiveCoordinator | null = null;

export function getCognitiveCoordinator(): CognitiveCoordinator {
  if (!coordinatorInstance) {
    coordinatorInstance = new CognitiveCoordinator();
  }
  return coordinatorInstance;
}
