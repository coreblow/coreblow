import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type CompactionNode,
  ImmutableGovernanceViolationError,
  ReversibleCompactionLedger,
} from "./reversible-compaction-ledger.js";

describe("ReversibleCompactionLedger", () => {
  let tempScratchpadDir: string;
  let ledger: ReversibleCompactionLedger;

  beforeEach(async () => {
    tempScratchpadDir = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-scratchpad-test-"));
    ledger = new ReversibleCompactionLedger(tempScratchpadDir);
  });

  afterEach(async () => {
    await fs.rm(tempScratchpadDir, { recursive: true, force: true });
  });

  it("mathematically preserves immutable governance tags during compaction (OWASP ASI06)", async () => {
    const nodes: CompactionNode[] = [
      {
        id: "gov-safety-1",
        role: "system",
        content: "CRITICAL: Never execute destructive rm -rf commands without explicit confirmation.",
        timestamp: 1000,
        immutable: true,
        governanceTag: "safety",
      },
      {
        id: "gov-trust-1",
        role: "system",
        content: "TRUST-ZONE: Zone 2 public channel untrusted ingress. Shell execution locked.",
        timestamp: 1001,
        immutable: true,
        governanceTag: "trust-zone",
      },
      {
        id: "msg-user-1",
        role: "user",
        content: "A".repeat(500),
        timestamp: 1002,
      },
      {
        id: "msg-tool-1",
        role: "tool",
        content: JSON.stringify({ items: Array.from({ length: 100 }, (_, i) => `item-${i}`) }),
        timestamp: 1003,
      },
      {
        id: "msg-asst-recent",
        role: "assistant",
        content: "Here is your response.",
        timestamp: 1004,
      },
    ];

    const result = await ledger.compact(nodes, {
      maxTokens: 50, // Extremely tight budget to force aggressive compaction
      preserveRecentTurns: 1,
      pointerThresholdBytes: 100,
    });

    // Immutable nodes must be present with exact contents intact
    const safetyNode = result.nodes.find((n) => n.id === "gov-safety-1");
    const trustNode = result.nodes.find((n) => n.id === "gov-trust-1");

    expect(safetyNode).toBeDefined();
    expect(safetyNode?.content).toBe(
      "CRITICAL: Never execute destructive rm -rf commands without explicit confirmation.",
    );
    expect(safetyNode?.immutable).toBe(true);

    expect(trustNode).toBeDefined();
    expect(trustNode?.content).toBe(
      "TRUST-ZONE: Zone 2 public channel untrusted ingress. Shell execution locked.",
    );

    expect(result.summary.immutableNodesPreserved).toBe(2);
    expect(result.summary.tokensReclaimed).toBeGreaterThan(0);
  });

  it("throws ImmutableGovernanceViolationError if an immutable node is tampered with", () => {
    const original: CompactionNode[] = [
      {
        id: "gov-1",
        role: "system",
        content: "IMMUTABLE SAFETY DIRECTIVE",
        timestamp: 1000,
        immutable: true,
        governanceTag: "safety",
      },
    ];

    const tampered: CompactionNode[] = [
      {
        id: "gov-1",
        role: "system",
        content: "MODIFIED DIRECTIVE", // content changed
        timestamp: 1000,
        immutable: true,
        governanceTag: "safety",
      },
    ];

    expect(() => ledger.verifyGovernanceIntegrity(original, tampered)).toThrow(
      ImmutableGovernanceViolationError,
    );
  });

  it("offloads large tool outputs to scratchpad pointers with two-way resolution", async () => {
    const largeToolPayload = JSON.stringify({
      status: "success",
      records: Array.from({ length: 50 }, (_, i) => ({
        index: i,
        uuid: `uuid-record-${i}`,
        data: `data-payload-${i}-${"X".repeat(20)}`,
      })),
    });

    const nodes: CompactionNode[] = [
      {
        id: "user-1",
        role: "user",
        content: "Fetch all user records",
        timestamp: 1000,
      },
      {
        id: "tool-result-large",
        role: "tool",
        content: largeToolPayload,
        timestamp: 1001,
      },
      {
        id: "asst-recent",
        role: "assistant",
        content: "I have fetched 50 records for you.",
        timestamp: 1002,
      },
    ];

    const result = await ledger.compact(nodes, {
      maxTokens: 5000,
      preserveRecentTurns: 1,
      pointerThresholdBytes: 150,
    });

    const compactedToolNode = result.nodes.find((n) => n.id === "tool-result-large");
    expect(compactedToolNode).toBeDefined();
    expect(compactedToolNode?.scratchpadPointer).toBeDefined();

    const pointer = compactedToolNode?.scratchpadPointer;
    expect(pointer?.contentHash).toHaveLength(64); // sha256 hex
    expect(pointer?.byteLength).toBe(Buffer.byteLength(largeToolPayload, "utf8"));
    expect(compactedToolNode?.content).toContain(
      `[CoreBlow Reversible Pointer: sha256:${pointer?.contentHash}`,
    );

    // Inspect offloaded content from scratchpad
    if (!pointer) throw new Error("Pointer expected");
    const inspected = await ledger.inspectScratchpadPointer(pointer);
    expect(inspected).toBe(largeToolPayload);

    // Lossless round-trip rehydration
    const rehydrated = await ledger.rehydrate(result.nodes);
    const rehydratedTool = rehydrated.find((n) => n.id === "tool-result-large");
    expect(rehydratedTool?.content).toBe(largeToolPayload);
    expect(rehydratedTool?.scratchpadPointer).toBeUndefined();
  });

  it("creates context summaries when token threshold demands reduction while preserving recent turns", async () => {
    const nodes: CompactionNode[] = [
      {
        id: "gov-system",
        role: "system",
        content: "System policy",
        timestamp: 1000,
        immutable: true,
      },
      {
        id: "turn-1",
        role: "user",
        content: "Step 1: Check server logs for error codes.",
        timestamp: 1001,
      },
      {
        id: "turn-2",
        role: "assistant",
        content: "Server logs show HTTP 504 Gateway Timeout in upstream auth service.",
        timestamp: 1002,
      },
      {
        id: "turn-3",
        role: "user",
        content: "Step 2: Restart the auth proxy service.",
        timestamp: 1003,
      },
      {
        id: "turn-4",
        role: "assistant",
        content: "Auth proxy service restarted successfully.",
        timestamp: 1004,
      },
      {
        id: "turn-recent-user",
        role: "user",
        content: "What is the status now?",
        timestamp: 1005,
      },
    ];

    const result = await ledger.compact(nodes, {
      maxTokens: 40, // Trigger summarization
      preserveRecentTurns: 1,
      summarizer: async (turns) => `Reviewed ${turns.length} troubleshooting steps.`,
    });

    expect(result.summary.tokensReclaimed).toBeGreaterThan(0);
    expect(result.summary.summaryText).toContain("Reviewed 4 troubleshooting steps.");

    const systemNode = result.nodes.find((n) => n.id === "gov-system");
    expect(systemNode).toBeDefined();

    const recentNode = result.nodes.find((n) => n.id === "turn-recent-user");
    expect(recentNode).toBeDefined();
    expect(recentNode?.content).toBe("What is the status now?");
  });
});
