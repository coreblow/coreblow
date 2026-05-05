import Foundation
import Testing
@testable import CoreBlow

struct ExecApprovalsSocketPathGuardTests {
    @Test func `accepts socket path within state directory`() {
        let stateDir = "/tmp/coreblow-state-test"
        let socketPath = "\(stateDir)/approvals.sock"
        #expect(ExecApprovalsSocketPathGuard.isAllowed(socketPath: socketPath, stateDir: stateDir))
    }

    @Test func `rejects socket path outside state directory`() {
        let stateDir = "/tmp/coreblow-state-test"
        let socketPath = "/tmp/evil/approvals.sock"
        #expect(!ExecApprovalsSocketPathGuard.isAllowed(socketPath: socketPath, stateDir: stateDir))
    }

    @Test func `rejects traversal attack in socket path`() {
        let stateDir = "/tmp/coreblow-state-test"
        let socketPath = "\(stateDir)/../evil/approvals.sock"
        #expect(!ExecApprovalsSocketPathGuard.isAllowed(socketPath: socketPath, stateDir: stateDir))
    }

    @Test func `rejects symlink-like traversal`() {
        let stateDir = "/tmp/coreblow-state-test"
        let socketPath = "\(stateDir)/./../../evil.sock"
        #expect(!ExecApprovalsSocketPathGuard.isAllowed(socketPath: socketPath, stateDir: stateDir))
    }

    @Test func `accepts socket with subdirectory in state dir`() {
        let stateDir = "/tmp/coreblow-state-test"
        let socketPath = "\(stateDir)/sockets/approvals.sock"
        #expect(ExecApprovalsSocketPathGuard.isAllowed(socketPath: socketPath, stateDir: stateDir))
    }
}
