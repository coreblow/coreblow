import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { resolveStateDir } from "../../config/paths.js";

export type GovernanceTag = "safety" | "trust-zone" | "system-directive" | "compliance";

export interface ScratchpadPointer {
  contentHash: string;
  byteLength: number;
  preview: string;
  originalRole: string;
  storagePath: string;
  createdTimestamp: number;
}

export interface CompactionNode {
  id: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  timestamp: number;
  immutable?: boolean;
  governanceTag?: GovernanceTag;
  scratchpadPointer?: ScratchpadPointer;
  tokens?: number;
}

export interface ReversibleCompactionOptions {
  maxTokens: number;
  preserveRecentTurns?: number;
  pointerThresholdBytes?: number;
  scratchpadDir?: string;
  summarizer?: (texts: string[]) => Promise<string>;
}

export interface CompactionSummary {
  cycleId: string;
  timestamp: number;
  originalTokenCount: number;
  compactedTokenCount: number;
  tokensReclaimed: number;
  immutableNodesPreserved: number;
  pointersCreated: number;
  summaryText?: string;
}

export interface ReversibleCompactionResult {
  nodes: CompactionNode[];
  summary: CompactionSummary;
}

export class ImmutableGovernanceViolationError extends Error {
  constructor(message: string) {
    super(`[OWASP ASI06/ASI07] Immutable Governance Tag Violation: ${message}`);
    this.name = "ImmutableGovernanceViolationError";
  }
}

export class ReversibleCompactionLedger {
  private readonly defaultScratchpadDir: string;
  private readonly auditLog: CompactionSummary[] = [];

  constructor(customScratchpadDir?: string) {
    this.defaultScratchpadDir =
      customScratchpadDir ?? path.join(resolveStateDir(), "scratchpad");
  }

  public estimateNodeTokens(node: CompactionNode): number {
    if (typeof node.tokens === "number" && node.tokens >= 0) {
      return node.tokens;
    }
    // Standard heuristic: ~4 characters per token + 4 overhead tokens per message
    return Math.ceil(node.content.length / 4) + 4;
  }

  public estimateTotalTokens(nodes: CompactionNode[]): number {
    return nodes.reduce((sum, node) => sum + this.estimateNodeTokens(node), 0);
  }

  public async compact(
    nodes: CompactionNode[],
    options: ReversibleCompactionOptions,
  ): Promise<ReversibleCompactionResult> {
    const cycleId = `cycle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const scratchpadDir = options.scratchpadDir ?? this.defaultScratchpadDir;
    await fs.mkdir(scratchpadDir, { recursive: true, mode: 0o700 });

    const originalTokenCount = this.estimateTotalTokens(nodes);
    const pointerThreshold = options.pointerThresholdBytes ?? 250;
    const preserveRecentTurns = options.preserveRecentTurns ?? 2;

    const immutableNodes: CompactionNode[] = [];
    const mutableNodes: CompactionNode[] = [];

    for (const node of nodes) {
      if (node.immutable || node.governanceTag) {
        immutableNodes.push({ ...node, immutable: true });
      } else {
        mutableNodes.push({ ...node });
      }
    }

    let pointersCreated = 0;
    const splitIndex = Math.max(0, mutableNodes.length - preserveRecentTurns);
    const historyCandidateNodes = mutableNodes.slice(0, splitIndex);
    const recentProtectedNodes = mutableNodes.slice(splitIndex);

    // Stage 1: Offload eligible candidate payloads to scratchpad pointers
    const stage1Nodes: CompactionNode[] = [];
    for (const node of historyCandidateNodes) {
      const byteLen = Buffer.byteLength(node.content, "utf8");
      if (byteLen >= pointerThreshold && !node.scratchpadPointer) {
        const hash = createHash("sha256").update(node.content).digest("hex");
        const storagePath = path.join(scratchpadDir, `${hash}.dat`);
        await fs.writeFile(storagePath, node.content, "utf8");

        const previewSnippet =
          node.content.length > 80
            ? `${node.content.slice(0, 80).replace(/\s+/g, " ")}...`
            : node.content;

        const pointer: ScratchpadPointer = {
          contentHash: hash,
          byteLength: byteLen,
          preview: previewSnippet,
          originalRole: node.role,
          storagePath,
          createdTimestamp: Date.now(),
        };

        const pointerContent = `[CoreBlow Reversible Pointer: sha256:${hash} (${byteLen} bytes)] Preview: ${previewSnippet}`;
        stage1Nodes.push({
          ...node,
          content: pointerContent,
          scratchpadPointer: pointer,
          tokens: Math.ceil(pointerContent.length / 4) + 4,
        });
        pointersCreated += 1;
      } else {
        stage1Nodes.push(node);
      }
    }

    // Stage 2: Calculate token headroom with Immutable tags preserved
    const candidateMessages = [...stage1Nodes, ...recentProtectedNodes];
    const immutableTokens = this.estimateTotalTokens(immutableNodes);
    const remainingTokenBudget = Math.max(0, options.maxTokens - immutableTokens);

    let finalMutableNodes = candidateMessages;
    let summaryText: string | undefined;

    if (this.estimateTotalTokens(candidateMessages) > remainingTokenBudget) {
      // Stage 3: Generate summary of oldest non-recent nodes
      const toSummarize = stage1Nodes;
      if (toSummarize.length > 0) {
        if (options.summarizer) {
          summaryText = await options.summarizer(toSummarize.map((n) => `${n.role}: ${n.content}`));
        } else {
          summaryText = `Summary of ${toSummarize.length} prior turns: compacted to preserve context budget.`;
        }

        const summaryNode: CompactionNode = {
          id: `summary-${Date.now()}`,
          role: "system",
          content: `[Previous Context Summary]: ${summaryText}`,
          timestamp: Date.now(),
          tokens: Math.ceil(summaryText.length / 4) + 8,
        };
        finalMutableNodes = [summaryNode, ...recentProtectedNodes];
      }
    }

    // Combine immutable governance nodes with compacted mutable nodes
    const finalNodes: CompactionNode[] = [...immutableNodes, ...finalMutableNodes];

    // Mathematical verification: Ensure 100% of immutable nodes survived intact
    this.verifyGovernanceIntegrity(nodes, finalNodes);

    const compactedTokenCount = this.estimateTotalTokens(finalNodes);
    const tokensReclaimed = Math.max(0, originalTokenCount - compactedTokenCount);

    const summary: CompactionSummary = {
      cycleId,
      timestamp: Date.now(),
      originalTokenCount,
      compactedTokenCount,
      tokensReclaimed,
      immutableNodesPreserved: immutableNodes.length,
      pointersCreated,
      summaryText,
    };

    this.auditLog.push(summary);
    return {
      nodes: finalNodes,
      summary,
    };
  }

  public async rehydrate(
    nodes: CompactionNode[],
    targetHashes?: string[],
  ): Promise<CompactionNode[]> {
    const hashSet = targetHashes ? new Set(targetHashes) : null;
    const rehydrated: CompactionNode[] = [];

    for (const node of nodes) {
      if (node.scratchpadPointer) {
        const { contentHash, storagePath } = node.scratchpadPointer;
        if (!hashSet || hashSet.has(contentHash)) {
          try {
            const fullContent = await fs.readFile(storagePath, "utf8");
            const actualHash = createHash("sha256").update(fullContent).digest("hex");
            if (actualHash !== contentHash) {
              throw new Error(
                `Scratchpad content hash mismatch for ${contentHash}: got ${actualHash}`,
              );
            }
            rehydrated.push({
              ...node,
              content: fullContent,
              scratchpadPointer: undefined,
              tokens: Math.ceil(fullContent.length / 4) + 4,
            });
            continue;
          } catch (err) {
            throw new Error(
              `Failed to rehydrate scratchpad pointer ${contentHash}: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
          }
        }
      }
      rehydrated.push(node);
    }

    return rehydrated;
  }

  public async inspectScratchpadPointer(pointer: ScratchpadPointer): Promise<string> {
    const content = await fs.readFile(pointer.storagePath, "utf8");
    const actualHash = createHash("sha256").update(content).digest("hex");
    if (actualHash !== pointer.contentHash) {
      throw new Error(
        `Scratchpad content verification failed: expected ${pointer.contentHash}, got ${actualHash}`,
      );
    }
    return content;
  }

  public verifyGovernanceIntegrity(
    originalNodes: CompactionNode[],
    compactedNodes: CompactionNode[],
  ): boolean {
    const originalImmutable = originalNodes.filter(
      (n) => n.immutable || n.governanceTag !== undefined,
    );
    const compactedMap = new Map<string, CompactionNode>();
    for (const node of compactedNodes) {
      compactedMap.set(node.id, node);
    }

    for (const orig of originalImmutable) {
      const compacted = compactedMap.get(orig.id);
      if (!compacted) {
        throw new ImmutableGovernanceViolationError(
          `Node '${orig.id}' with governance tag '${orig.governanceTag ?? "immutable"}' was evicted during compaction.`,
        );
      }
      if (compacted.content !== orig.content) {
        throw new ImmutableGovernanceViolationError(
          `Node '${orig.id}' with governance tag '${orig.governanceTag ?? "immutable"}' had its content altered during compaction.`,
        );
      }
      if (compacted.role !== orig.role) {
        throw new ImmutableGovernanceViolationError(
          `Node '${orig.id}' had its role altered from '${orig.role}' to '${compacted.role}'.`,
        );
      }
    }

    return true;
  }

  public getAuditHistory(): CompactionSummary[] {
    return [...this.auditLog];
  }
}
