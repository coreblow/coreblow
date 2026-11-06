/**
 * CoreBlow Stage 6 — War Room DAG & Orchestrator Adversarial Stress Test Suite
 *
 * Empirical verification suite by Teamwork Challenger (Stage 6 Phase 2).
 * Stress-tests:
 * 1. War Room DAG State Machine:
 *    - Full column traversals (backlog -> in_progress -> review -> done)
 *    - Member liveState synchronization with multi-task pipelines
 *    - Sibling thread forking with recursive multi-generation child branches and lineage notes
 *    - Child approval relay under concurrent requests and denial rollbacks
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  WarRoomOrchestratorService,
  type WarRoomMember,
  type WarRoomSession,
  type KanbanTaskCard,
} from "./war-room-service.js";

describe("WarRoomOrchestratorService: Adversarial Stress Test Suite", () => {
  let service: WarRoomOrchestratorService;

  beforeEach(async () => {
    service = new WarRoomOrchestratorService();
    await service.start();
  });

  // =========================================================================
  // 1. War Room DAG State Machine: Moving cards across columns
  // =========================================================================
  describe("DAG State Machine: Column Transitions & Boundary Resilience", () => {
    it("moves cards through complete lifecycle: backlog -> in_progress -> review -> done", async () => {
      const room = service.createWarRoom({
        roomId: "room-lifecycle-1",
        title: "Lifecycle Room",
        purpose: "Stress testing full column traversal",
      });

      // Route message to create initial card in in_progress
      const routing = await service.routeMessageViaLead(
        room.roomId,
        "Implement secure OAuth2 PKCE authorization flow in TypeScript",
      );
      const taskId = routing.kanbanCard.taskId;
      const specialistId = routing.delegatedToAgentId;

      expect(routing.kanbanCard.column).toBe("in_progress");

      // Verify specialist is in thinking or executing_tool
      let updatedRoom = service.getWarRoom(room.roomId)!;
      let member = updatedRoom.members.find((m) => m.agentId === specialistId)!;
      expect(member.liveState).toBe("thinking");

      // Transition to review
      updatedRoom = service.moveKanbanCard(room.roomId, taskId, "review");
      let card = updatedRoom.kanbanBoard.find((c) => c.taskId === taskId)!;
      expect(card.column).toBe("review");
      member = updatedRoom.members.find((m) => m.agentId === specialistId)!;
      expect(member.liveState).toBe("awaiting_approval");

      // Transition to done
      updatedRoom = service.moveKanbanCard(room.roomId, taskId, "done");
      card = updatedRoom.kanbanBoard.find((c) => c.taskId === taskId)!;
      expect(card.column).toBe("done");
      member = updatedRoom.members.find((m) => m.agentId === specialistId)!;
      expect(member.liveState).toBe("completed");

      // Move backward to in_progress (rework request)
      updatedRoom = service.moveKanbanCard(room.roomId, taskId, "in_progress");
      card = updatedRoom.kanbanBoard.find((c) => c.taskId === taskId)!;
      expect(card.column).toBe("in_progress");
      member = updatedRoom.members.find((m) => m.agentId === specialistId)!;
      expect(member.liveState).toBe("executing_tool");

      // Move back to done
      updatedRoom = service.moveKanbanCard(room.roomId, taskId, "done");
      card = updatedRoom.kanbanBoard.find((c) => c.taskId === taskId)!;
      expect(card.column).toBe("done");
      member = updatedRoom.members.find((m) => m.agentId === specialistId)!;
      expect(member.liveState).toBe("completed");
    });

    it("throws clear errors on invalid room or card identifiers", () => {
      expect(() => {
        service.moveKanbanCard("non-existent-room", "task-1", "done");
      }).toThrow(/War room "non-existent-room" not found/);

      const room = service.createWarRoom({
        title: "Empty Room",
        purpose: "Error boundary test",
      });

      expect(() => {
        service.moveKanbanCard(room.roomId, "phantom-task", "done");
      }).toThrow(/Kanban card "phantom-task" not found in room/);
    });
  });

  // =========================================================================
  // 2. Member liveState Synchronization with Multiple Tasks
  // =========================================================================
  describe("Member liveState Synchronization: Multi-Task Pipeline", () => {
    it("keeps agent in progress while remaining tasks exist, only completing when all tasks finish", async () => {
      const room = service.createWarRoom({
        roomId: "room-multi-task",
        title: "Multi-Task Stress Room",
        purpose: "Verifying liveState synchronization under concurrent pipeline",
      });

      // Route 3 distinct coding tasks to the coder agent
      const route1 = await service.routeMessageViaLead(
        room.roomId,
        "Implement JWT token validation function in auth.ts",
      );
      const route2 = await service.routeMessageViaLead(
        room.roomId,
        "Refactor password hashing to argon2id in hasher.ts",
      );
      const route3 = await service.routeMessageViaLead(
        room.roomId,
        "Write unit tests for authentication middleware in auth.test.ts",
      );

      const coderId = route1.delegatedToAgentId;
      expect(route2.delegatedToAgentId).toBe(coderId);
      expect(route3.delegatedToAgentId).toBe(coderId);

      const task1 = route1.kanbanCard.taskId;
      const task2 = route2.kanbanCard.taskId;
      const task3 = route3.kanbanCard.taskId;

      // Finish Task 1 -> Coder must still have remaining tasks in in_progress, so must NOT be completed
      let currentRoom = service.moveKanbanCard(room.roomId, task1, "done");
      let coder = currentRoom.members.find((m) => m.agentId === coderId)!;
      expect(coder.liveState).not.toBe("completed");

      // Move Task 2 to review -> Coder transitions to awaiting_approval
      currentRoom = service.moveKanbanCard(room.roomId, task2, "review");
      coder = currentRoom.members.find((m) => m.agentId === coderId)!;
      expect(coder.liveState).toBe("awaiting_approval");

      // Finish Task 2 from review -> Still has Task 3 in in_progress
      currentRoom = service.moveKanbanCard(room.roomId, task2, "done");
      coder = currentRoom.members.find((m) => m.agentId === coderId)!;
      // Task 3 is still in_progress, so coder must not be completed
      expect(coder.liveState).not.toBe("completed");

      // Finally finish Task 3 -> All tasks are done, coder liveState must become 'completed'
      currentRoom = service.moveKanbanCard(room.roomId, task3, "done");
      coder = currentRoom.members.find((m) => m.agentId === coderId)!;
      expect(coder.liveState).toBe("completed");
    });

    it("handles multiple specialist agents executing concurrently without state crosstalk", async () => {
      const room = service.createWarRoom({
        roomId: "room-parallel-squad",
        title: "Parallel Specialist Squad",
        purpose: "Auditor, Coder, and Verifier concurrent execution",
      });

      // Delegate to Auditor
      const auditRoute = await service.routeMessageViaLead(
        room.roomId,
        "Audit cryptographic implementation for secret exfiltration vulnerability",
      );
      // Delegate to Coder
      const codeRoute = await service.routeMessageViaLead(
        room.roomId,
        "Implement rate limiting middleware algorithm in TypeScript",
      );
      // Delegate to Verifier
      const verifyRoute = await service.routeMessageViaLead(
        room.roomId,
        "Run verification benchmark smoke test for gateway latency",
      );

      const auditorId = auditRoute.delegatedToAgentId;
      const coderId = codeRoute.delegatedToAgentId;
      const verifierId = verifyRoute.delegatedToAgentId;

      expect(auditorId).not.toBe(coderId);
      expect(coderId).not.toBe(verifierId);

      // Complete Auditor task
      let currentRoom = service.moveKanbanCard(room.roomId, auditRoute.kanbanCard.taskId, "done");
      let auditor = currentRoom.members.find((m) => m.agentId === auditorId)!;
      let coder = currentRoom.members.find((m) => m.agentId === coderId)!;
      let verifier = currentRoom.members.find((m) => m.agentId === verifierId)!;

      expect(auditor.liveState).toBe("completed");
      expect(coder.liveState).not.toBe("completed");
      expect(verifier.liveState).not.toBe("completed");

      // Move Coder to review
      currentRoom = service.moveKanbanCard(room.roomId, codeRoute.kanbanCard.taskId, "review");
      coder = currentRoom.members.find((m) => m.agentId === coderId)!;
      verifier = currentRoom.members.find((m) => m.agentId === verifierId)!;
      expect(coder.liveState).toBe("awaiting_approval");
      expect(verifier.liveState).not.toBe("awaiting_approval");

      // Complete Verifier
      currentRoom = service.moveKanbanCard(room.roomId, verifyRoute.kanbanCard.taskId, "done");
      verifier = currentRoom.members.find((m) => m.agentId === verifierId)!;
      expect(verifier.liveState).toBe("completed");
    });
  });

  // =========================================================================
  // 3. Sibling Thread Forking with Recursive Child Branches
  // =========================================================================
  describe("Sibling Thread Forking: Recursive Multi-Generation Lineage", () => {
    it("supports multi-level recursive thread forking while maintaining lineage notes & inherited skills", async () => {
      const rootRoom = service.createWarRoom({
        roomId: "room-root-alpha",
        title: "Root Architecture Squad",
        purpose: "High-level architecture design",
        inheritedSkills: ["skill-zero-trust", "skill-bayesian-eval"],
      });

      // Level 1 Fork
      const fork1 = service.forkSiblingThread(rootRoom.roomId, "Level 1: Storage Subsystem");
      expect(fork1.parentRoomId).toBe(rootRoom.roomId);

      const level1Room = service.getWarRoom(fork1.forkedThreadId);
      expect(level1Room).toBeDefined();
      expect(level1Room!.inheritedSkills).toEqual(["skill-zero-trust", "skill-bayesian-eval"]);
      expect(level1Room!.sharedNotes[0]).toContain(rootRoom.roomId);

      // Verify root room records fork1
      const updatedRoot = service.getWarRoom(rootRoom.roomId)!;
      expect(updatedRoot.forkedThreadIds).toContain(fork1.forkedThreadId);

      // Level 2 Fork (from Level 1 child)
      const fork2 = service.forkSiblingThread(level1Room!.roomId, "Level 2: SQLite WAL Compactor");
      expect(fork2.parentRoomId).toBe(level1Room!.roomId);

      const level2Room = service.getWarRoom(fork2.forkedThreadId);
      expect(level2Room).toBeDefined();
      expect(level2Room!.inheritedSkills).toEqual(["skill-zero-trust", "skill-bayesian-eval"]);
      expect(level2Room!.sharedNotes[0]).toContain(level1Room!.roomId);

      // Level 3 Fork (from Level 2 grandchild)
      const fork3 = service.forkSiblingThread(level2Room!.roomId, "Level 3: Snapshot Pruner Daemon");
      expect(fork3.parentRoomId).toBe(level2Room!.roomId);

      const level3Room = service.getWarRoom(fork3.forkedThreadId);
      expect(level3Room).toBeDefined();
      expect(level3Room!.inheritedSkills).toEqual(["skill-zero-trust", "skill-bayesian-eval"]);
      expect(level3Room!.sharedNotes[0]).toContain(level2Room!.roomId);

      // Verify isolation: Level 3 kanban is empty and separate from root
      await service.routeMessageViaLead(level3Room!.roomId, "Implement snapshot pruning command");
      const populatedL3 = service.getWarRoom(level3Room!.roomId)!;
      expect(populatedL3.kanbanBoard).toHaveLength(1);

      const cleanRoot = service.getWarRoom(rootRoom.roomId)!;
      expect(cleanRoot.kanbanBoard).toHaveLength(0);
    });
  });

  // =========================================================================
  // 4. Child Approval Relay: Concurrent Approvals & Denial Rollback
  // =========================================================================
  describe("Child Approval Relay: Concurrent Approvals & Denial Rollbacks", () => {
    it("relays and resolves multiple approvals concurrently with correct state rollback on denial", async () => {
      const room = service.createWarRoom({
        roomId: "room-approvals",
        title: "Approval Defense Room",
        purpose: "Stress testing approval relay concurrency and rollback",
      });

      // Relay approval for Coder
      const coderApproval = service.relayChildApprovalToParent(room.roomId, {
        approvalId: "appr-coder-1",
        parentSessionId: room.roomId,
        childSessionId: "session-sub-1",
        agentId: "agent-coder",
        toolName: "filesystem_write",
      });

      // Relay approval for Auditor concurrently
      const auditorApproval = service.relayChildApprovalToParent(room.roomId, {
        approvalId: "appr-auditor-1",
        parentSessionId: room.roomId,
        childSessionId: "session-sub-2",
        agentId: "agent-auditor",
        toolName: "network_socket_bind",
      });

      let currentRoom = service.getWarRoom(room.roomId)!;
      expect(currentRoom.pendingApprovals).toHaveLength(2);

      let coderMember = currentRoom.members.find((m) => m.agentId === "agent-coder")!;
      let auditorMember = currentRoom.members.find((m) => m.agentId === "agent-auditor")!;
      expect(coderMember.liveState).toBe("awaiting_approval");
      expect(auditorMember.liveState).toBe("awaiting_approval");

      // Approve Coder tool execution -> liveState becomes executing_tool
      const resolvedCoder = service.resolveChildApproval(room.roomId, coderApproval.approvalId, "approved");
      expect(resolvedCoder.status).toBe("approved");

      currentRoom = service.getWarRoom(room.roomId)!;
      coderMember = currentRoom.members.find((m) => m.agentId === "agent-coder")!;
      auditorMember = currentRoom.members.find((m) => m.agentId === "agent-auditor")!;
      expect(coderMember.liveState).toBe("executing_tool");
      expect(auditorMember.liveState).toBe("awaiting_approval"); // Still awaiting

      // Deny Auditor tool execution -> liveState rolls back to idle
      const resolvedAuditor = service.resolveChildApproval(room.roomId, auditorApproval.approvalId, "denied");
      expect(resolvedAuditor.status).toBe("denied");

      currentRoom = service.getWarRoom(room.roomId)!;
      auditorMember = currentRoom.members.find((m) => m.agentId === "agent-auditor")!;
      expect(auditorMember.liveState).toBe("idle"); // Rolled back to idle

      // Both approvals are resolved in pendingApprovals history
      expect(currentRoom.pendingApprovals[0].status).toBe("approved");
      expect(currentRoom.pendingApprovals[1].status).toBe("denied");
    });

    it("throws when resolving an unknown approvalId", () => {
      const room = service.createWarRoom({
        title: "Approval Error Room",
        purpose: "Error boundary test",
      });

      expect(() => {
        service.resolveChildApproval(room.roomId, "ghost-approval", "approved");
      }).toThrow(/Child approval "ghost-approval" not found/);
    });
  });
});
