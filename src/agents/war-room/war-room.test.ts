import { describe, it, expect, beforeEach } from "vitest";
import {
  WarRoomOrchestratorService,
  parseMentions,
  type AgentScreenFrame,
  type WarRoomChatMessage,
  type WarRoomMember,
  type WarRoomSession,
} from "./war-room-service.js";

describe("WarRoomOrchestratorService", () => {
  let service: WarRoomOrchestratorService;

  beforeEach(() => {
    service = new WarRoomOrchestratorService();
  });

  describe("Lifecycle and Health", () => {
    it("reports down health before start, healthy when running, and down after stop", async () => {
      expect(service.name).toBe("war-room-orchestrator");
      expect(service.health().status).toBe("down");

      await service.start();
      expect(service.health().status).toBe("healthy");
      expect(service.health().detail).toBe("Managing 0 war room sessions");

      service.createWarRoom({
        title: "Test Room",
        purpose: "Health check verification",
      });
      expect(service.health().detail).toBe("Managing 1 war room sessions");

      await service.stop();
      expect(service.health().status).toBe("down");
      expect(service.listWarRooms()).toHaveLength(0);
    });
  });

  describe("Room Creation and Pure DOP Contracts", () => {
    it("creates war room with default 5 specialist roles when members are omitted", async () => {
      await service.start();
      const room = service.createWarRoom({
        roomId: "room-default-squad",
        title: "Default Squad War Room",
        purpose: "Autonomous specialist coordination",
      });

      expect(room.roomId).toBe("room-default-squad");
      expect(room.title).toBe("Default Squad War Room");
      expect(room.purpose).toBe("Autonomous specialist coordination");
      expect(room.leadAgentId).toBe("agent-lead");
      expect(room.members).toHaveLength(5);

      const roles = room.members.map((m) => m.role);
      expect(roles).toEqual(["lead", "coder", "researcher", "auditor", "verifier"]);

      const lead = room.members.find((m) => m.role === "lead")!;
      expect(lead.routeTier).toBe("decision");
      expect(lead.liveState).toBe("idle");

      const coder = room.members.find((m) => m.role === "coder")!;
      expect(coder.routeTier).toBe("coding");
      expect(coder.liveState).toBe("idle");

      const researcher = room.members.find((m) => m.role === "researcher")!;
      expect(researcher.routeTier).toBe("deep");
      expect(researcher.liveState).toBe("idle");

      const auditor = room.members.find((m) => m.role === "auditor")!;
      expect(auditor.routeTier).toBe("deep");
      expect(auditor.liveState).toBe("idle");

      const verifier = room.members.find((m) => m.role === "verifier")!;
      expect(verifier.routeTier).toBe("fast");
      expect(verifier.liveState).toBe("idle");

      expect(room.kanbanBoard).toEqual([]);
      expect(room.forkedThreadIds).toEqual([]);
      expect(room.pendingApprovals).toEqual([]);
      expect(room.inheritedSkills).toEqual([]);
    });

    it("creates war room with custom members and inherited skills", async () => {
      await service.start();
      const customMembers: readonly WarRoomMember[] = [
        {
          agentId: "agent-custom-lead",
          name: "Custom Lead",
          role: "lead",
          routeTier: "decision",
          liveState: "idle",
        },
        {
          agentId: "agent-custom-coder",
          name: "Custom Coder",
          role: "coder",
          routeTier: "coding",
          liveState: "idle",
        },
      ];

      const room = service.createWarRoom({
        title: "Custom Squad",
        purpose: "Targeted refactoring",
        leadAgentId: "agent-custom-lead",
        members: customMembers,
        inheritedSkills: ["skill-ts-refactor", "skill-vitest-harness"],
      });

      expect(room.leadAgentId).toBe("agent-custom-lead");
      expect(room.members).toHaveLength(2);
      expect(room.inheritedSkills).toEqual(["skill-ts-refactor", "skill-vitest-harness"]);
      expect(service.getWarRoom(room.roomId)).toBeDefined();
    });
  });

  describe("Lead Agent Task Routing and Skill Injection", () => {
    it("classifies prompts and delegates tasks to appropriate specialist member with in_progress Kanban card", async () => {
      // Mock skill synthesizer with verified active skills
      const mockSynthesizer = {
        listSkills: async () => [
          { id: "skill-microkernel-arch", status: "verified_active" },
          { id: "skill-crypto-verify", status: "verified_active" },
        ],
      } as any;

      const orch = new WarRoomOrchestratorService({ skillSynthesizer: mockSynthesizer });
      await orch.start();

      const room = orch.createWarRoom({
        roomId: "room-routing",
        title: "Routing Chamber",
        purpose: "Route classification testing",
        inheritedSkills: ["skill-base-core"],
      });

      // 1. Coding prompt -> Coder
      const codeResult = await orch.routeMessageViaLead(
        room.roomId,
        "Implement a new TypeScript function to refactor the microkernel state machine",
      );
      expect(codeResult.leadAgentId).toBe("agent-lead");
      expect(codeResult.delegatedToAgentId).toBe("agent-coder");
      expect(codeResult.routeTier).toBe("coding");
      expect(codeResult.kanbanCard.column).toBe("in_progress");
      expect(codeResult.kanbanCard.assigneeAgentId).toBe("agent-coder");
      expect(codeResult.sharedSkillsInjected).toEqual([
        "skill-base-core",
        "skill-microkernel-arch",
        "skill-crypto-verify",
      ]);

      // Check member state transitioned to thinking
      const updatedRoom1 = orch.getWarRoom(room.roomId)!;
      const coderMember = updatedRoom1.members.find((m) => m.agentId === "agent-coder")!;
      expect(coderMember.liveState).toBe("thinking");
      expect(updatedRoom1.kanbanBoard).toHaveLength(1);

      // 2. Audit/Security prompt -> Auditor
      const auditResult = await orch.routeMessageViaLead(
        room.roomId,
        "Perform a thorough security audit on all endpoints to prevent secret leaks and cve vulnerabilities",
      );
      expect(auditResult.delegatedToAgentId).toBe("agent-auditor");
      expect(auditResult.routeTier).toBe("deep");
      expect(auditResult.kanbanCard.column).toBe("in_progress");

      // 3. Research/Investigation prompt -> Researcher
      const researchResult = await orch.routeMessageViaLead(
        room.roomId,
        "Investigate the literature and explore academic surveys on consensus algorithms",
      );
      expect(researchResult.delegatedToAgentId).toBe("agent-researcher");
      expect(researchResult.routeTier).toBe("deep");

      // 4. Verification/Smoke prompt -> Verifier
      const verifyResult = await orch.routeMessageViaLead(
        room.roomId,
        "Run the smoke benchmark metrics and assert verification gates pass",
      );
      expect(verifyResult.delegatedToAgentId).toBe("agent-verifier");
      expect(verifyResult.routeTier).toBe("fast");

      const finalRoom = orch.getWarRoom(room.roomId)!;
      expect(finalRoom.kanbanBoard).toHaveLength(4);
    });

    it("truncates very long prompt titles in KanbanTaskCard", async () => {
      await service.start();
      const room = service.createWarRoom({
        roomId: "room-truncation",
        title: "Truncation Room",
        purpose: "Test prompt truncation",
      });

      const longPrompt = "A".repeat(120);
      const result = await service.routeMessageViaLead(room.roomId, longPrompt);
      expect(result.kanbanCard.title).toHaveLength(80);
      expect(result.kanbanCard.title.endsWith("...")).toBe(true);
    });

    it("throws when routing to a non-existent room", async () => {
      await service.start();
      await expect(
        service.routeMessageViaLead("non-existent-room", "Fix bug in parser"),
      ).rejects.toThrow('War room "non-existent-room" not found');
    });
  });

  describe("Thread Forking with Lineage Preservation", () => {
    it("forks sibling thread preserving parent lineage and inherited skills", async () => {
      await service.start();
      const parent = service.createWarRoom({
        roomId: "room-parent-main",
        title: "Main Investigation",
        purpose: "Root cause analysis",
        inheritedSkills: ["skill-root-cause"],
      });

      const forkResult = service.forkSiblingThread(parent.roomId, "Deep Dive into Memory Pressure");
      expect(forkResult.parentRoomId).toBe("room-parent-main");
      expect(forkResult.forkedThreadId).toContain("fork_room-parent-main_");

      // Parent now lists the forked thread id
      const updatedParent = service.getWarRoom(parent.roomId)!;
      expect(updatedParent.forkedThreadIds).toContain(forkResult.forkedThreadId);

      // Sibling thread exists as an independent room with parent skills and lineage
      const sibling = service.getWarRoom(forkResult.forkedThreadId)!;
      expect(sibling.title).toBe("Deep Dive into Memory Pressure");
      expect(sibling.sharedNotes[0]).toContain("Forked lineage from parent room room-parent-main");
      expect(sibling.inheritedSkills).toEqual(["skill-root-cause"]);
      expect(sibling.members).toEqual(parent.members);
    });

    it("throws when forking a non-existent room", async () => {
      await service.start();
      expect(() => service.forkSiblingThread("missing-room", "Subtopic")).toThrow(
        'War room "missing-room" not found',
      );
    });
  });

  describe("Child Approval Relay and Resolution", () => {
    it("relays approval request and transitions agent liveState to awaiting_approval", async () => {
      await service.start();
      const room = service.createWarRoom({
        roomId: "room-approvals",
        title: "Approvals Testing",
        purpose: "Verifying approval escalation",
      });

      const req = service.relayChildApprovalToParent(room.roomId, {
        approvalId: "appr-001",
        parentSessionId: room.roomId,
        childSessionId: "child-worker-1",
        agentId: "agent-coder",
        toolName: "run_command",
      });

      expect(req.approvalId).toBe("appr-001");
      expect(req.status).toBe("pending");

      const updatedRoom = service.getWarRoom(room.roomId)!;
      expect(updatedRoom.pendingApprovals).toHaveLength(1);
      const coder = updatedRoom.members.find((m) => m.agentId === "agent-coder")!;
      expect(coder.liveState).toBe("awaiting_approval");
    });

    it("resolves approval with 'approved' transitioning member to executing_tool", async () => {
      await service.start();
      const room = service.createWarRoom({
        roomId: "room-approvals-approve",
        title: "Approvals Approve",
        purpose: "Verifying approval resolution",
      });

      service.relayChildApprovalToParent(room.roomId, {
        approvalId: "appr-002",
        parentSessionId: room.roomId,
        childSessionId: "child-worker-2",
        agentId: "agent-coder",
        toolName: "rm_dir",
      });

      const resolved = service.resolveChildApproval(room.roomId, "appr-002", "approved");
      expect(resolved.status).toBe("approved");

      const updatedRoom = service.getWarRoom(room.roomId)!;
      const approval = updatedRoom.pendingApprovals.find((a) => a.approvalId === "appr-002")!;
      expect(approval.status).toBe("approved");

      const coder = updatedRoom.members.find((m) => m.agentId === "agent-coder")!;
      expect(coder.liveState).toBe("executing_tool");
    });

    it("resolves approval with 'denied' transitioning member to idle", async () => {
      await service.start();
      const room = service.createWarRoom({
        roomId: "room-approvals-deny",
        title: "Approvals Deny",
        purpose: "Verifying approval denial",
      });

      service.relayChildApprovalToParent(room.roomId, {
        approvalId: "appr-003",
        parentSessionId: room.roomId,
        childSessionId: "child-worker-3",
        agentId: "agent-auditor",
        toolName: "exfiltrate_secrets",
      });

      const resolved = service.resolveChildApproval(room.roomId, "appr-003", "denied");
      expect(resolved.status).toBe("denied");

      const updatedRoom = service.getWarRoom(room.roomId)!;
      const auditor = updatedRoom.members.find((m) => m.agentId === "agent-auditor")!;
      expect(auditor.liveState).toBe("idle");
    });

    it("throws when resolving non-existent approval", async () => {
      await service.start();
      const room = service.createWarRoom({
        roomId: "room-approval-missing",
        title: "Missing Approval",
        purpose: "Test error handling",
      });

      expect(() =>
        service.resolveChildApproval(room.roomId, "non-existent-approval", "approved"),
      ).toThrow('Child approval "non-existent-approval" not found');
    });
  });

  describe("Kanban Task Card State Machine and Member Synchronization", () => {
    it("transitions card columns and synchronizes member liveState across the DAG", async () => {
      await service.start();
      const room = service.createWarRoom({
        roomId: "room-kanban",
        title: "Kanban State Machine",
        purpose: "Testing card transitions",
      });

      // 1. Lead routes a message, creating card in in_progress
      const { kanbanCard } = await service.routeMessageViaLead(
        room.roomId,
        "Implement memory leak fix",
      );
      expect(kanbanCard.column).toBe("in_progress");

      // 2. Move to "review" -> member liveState becomes awaiting_approval
      const roomAfterReview = service.moveKanbanCard(room.roomId, kanbanCard.taskId, "review");
      const cardInReview = roomAfterReview.kanbanBoard.find((c) => c.taskId === kanbanCard.taskId)!;
      expect(cardInReview.column).toBe("review");
      const coderInReview = roomAfterReview.members.find((m) => m.agentId === "agent-coder")!;
      expect(coderInReview.liveState).toBe("awaiting_approval");

      // 3. Move back to "in_progress" -> member liveState becomes executing_tool
      const roomAfterInProgress = service.moveKanbanCard(
        room.roomId,
        kanbanCard.taskId,
        "in_progress",
      );
      const coderInProgress = roomAfterInProgress.members.find((m) => m.agentId === "agent-coder")!;
      expect(coderInProgress.liveState).toBe("executing_tool");

      // 4. Move to "done" -> member liveState becomes completed
      const roomAfterDone = service.moveKanbanCard(room.roomId, kanbanCard.taskId, "done");
      const cardInDone = roomAfterDone.kanbanBoard.find((c) => c.taskId === kanbanCard.taskId)!;
      expect(cardInDone.column).toBe("done");
      const coderDone = roomAfterDone.members.find((m) => m.agentId === "agent-coder")!;
      expect(coderDone.liveState).toBe("completed");
    });

    it("does not set member liveState to completed if agent has other in_progress cards", async () => {
      await service.start();
      const room = service.createWarRoom({
        roomId: "room-multi-task",
        title: "Multiple Tasks",
        purpose: "Test multiple in_progress cards for same agent",
      });

      const { kanbanCard: card1 } = await service.routeMessageViaLead(
        room.roomId,
        "Implement first feature",
      );
      const { kanbanCard: card2 } = await service.routeMessageViaLead(
        room.roomId,
        "Implement second feature",
      );

      // Both cards are assigned to agent-coder in "in_progress"
      expect(card1.assigneeAgentId).toBe("agent-coder");
      expect(card2.assigneeAgentId).toBe("agent-coder");

      // Complete card1 while card2 is still in_progress
      const roomAfterCard1Done = service.moveKanbanCard(room.roomId, card1.taskId, "done");
      const coder = roomAfterCard1Done.members.find((m) => m.agentId === "agent-coder")!;
      // Should NOT be completed because card2 is still in_progress
      expect(coder.liveState).not.toBe("completed");

      // Now complete card2
      const roomAfterCard2Done = service.moveKanbanCard(room.roomId, card2.taskId, "done");
      const coderFinal = roomAfterCard2Done.members.find((m) => m.agentId === "agent-coder")!;
      expect(coderFinal.liveState).toBe("completed");
    });

    it("throws when moving non-existent card", async () => {
      await service.start();
      const room = service.createWarRoom({
        title: "Empty Room",
        purpose: "Testing non-existent card",
      });

      expect(() => service.moveKanbanCard(room.roomId, "missing-task", "done")).toThrow(
        'Kanban card "missing-task" not found',
      );
    });
  });

  describe("Squad Group Chat, @mention Routing & Live Agent Screen Stream", () => {
    it("parses @mentions correctly including @all expansion to all 4 execution specialists", () => {
      expect(parseMentions("Hello @coder please fix the bug")).toEqual(["coder"]);
      expect(parseMentions("@auditor and @verifier run tests")).toEqual(["auditor", "verifier"]);
      expect(parseMentions("Broadcast: @all full repo verification")).toEqual([
        "coder",
        "researcher",
        "auditor",
        "verifier",
      ]);
      expect(parseMentions("No mentions here")).toEqual([]);
    });

    it("dispatches multiple mentioned specialists in parallel via postSquadMessage", async () => {
      await service.start();
      const room = service.createWarRoom({
        title: "Squad Parallel Test",
        purpose: "Testing multi-specialist dispatch",
      });

      const result = await service.postSquadMessage(room.roomId, {
        content: "@coder @auditor review and patch the authentication middleware",
      });

      expect(result.userMessage.content).toBe("@coder @auditor review and patch the authentication middleware");
      expect(result.userMessage.mentions).toEqual(["coder", "auditor"]);
      expect(result.replies.length).toBe(2);

      const roles = result.replies.map((r) => r.senderRole);
      expect(roles).toContain("coder");
      expect(roles).toContain("auditor");

      // Verify messages are recorded in room state
      const updatedRoom = service.getWarRoom(room.roomId)!;
      expect(updatedRoom.messages.length).toBe(3); // 1 user + 2 replies
    });

    it("supports bounded agent-to-agent handoffs stopping at maxHandoffDepth", async () => {
      // Custom subagent dispatcher that causes @coder to hand off to @verifier
      const customService = new WarRoomOrchestratorService({
        subagentDispatcher: async (params) => {
          if (params.role === "coder") {
            return {
              output: "Code refactored. @verifier please verify test coverage.",
              exitCode: 0,
              toolCallsExecuted: ["patch"],
            };
          }
          if (params.role === "verifier") {
            return {
              output: "All unit tests pass 100% green. @auditor please audit security.",
              exitCode: 0,
              toolCallsExecuted: ["terminal"],
            };
          }
          return {
            output: `[${params.role}] Done.`,
            exitCode: 0,
          };
        },
      });

      await customService.start();
      const room = customService.createWarRoom({
        title: "Handoff Test",
        purpose: "Testing bounded agent handoffs",
      });

      // maxHandoffDepth = 1: coder replies and hands off to verifier, then stops
      const result = await customService.postSquadMessage(room.roomId, {
        content: "@coder implement feature",
        maxHandoffDepth: 1,
      });

      expect(result.replies.length).toBeGreaterThanOrEqual(2);
      const roles = result.replies.map((r) => r.senderRole);
      expect(roles).toContain("coder");
      expect(roles).toContain("verifier");
      // Auditor should NOT be called because maxHandoffDepth was 1
      expect(roles).not.toContain("auditor");
    });

    it("emits live AgentScreenFrame events and allows real-time pub/sub subscription", async () => {
      await service.start();
      const room = service.createWarRoom({
        title: "Live Stream Test",
        purpose: "Testing SSE event emission",
      });

      const framesReceived: AgentScreenFrame[] = [];
      const unsubscribe = service.subscribeScreenStream(room.roomId, (frame) => {
        framesReceived.push(frame);
      });

      // Send squad message
      await service.postSquadMessage(room.roomId, {
        content: "@verifier run smoke test",
      });

      expect(framesReceived.length).toBeGreaterThan(0);
      const kinds = framesReceived.map((f) => f.kind);
      expect(kinds).toContain("chat_message");
      expect(kinds).toContain("thinking");
      expect(kinds).toContain("tool_start");
      expect(kinds).toContain("tool_done");
      expect(kinds).toContain("kanban_move");

      // Verify screenFeed ring-buffer
      const feed = service.getScreenFeed(room.roomId, 10);
      expect(feed.length).toBeGreaterThan(0);

      // Verify unsubscribe halts notifications
      const prevCount = framesReceived.length;
      unsubscribe();
      service.emitScreenFrame(room.roomId, {
        agentId: "agent-lead",
        role: "lead",
        kind: "thinking",
        summary: "After unsubscribe",
      });
      expect(framesReceived.length).toBe(prevCount);
    });
  });
});
