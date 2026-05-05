import Foundation
import Testing
@testable import CoreBlow

struct ExecApprovalHelpersTests {
    @Test func `display summary for single command`() {
        let summary = ExecApprovalHelpers.displaySummary(
            command: ["/usr/bin/echo", "hello"],
            rawCommand: "/usr/bin/echo hello",
            cwd: "/tmp")
        #expect(summary.displayCommand == "/usr/bin/echo hello")
        #expect(summary.displayCwd == "/tmp")
    }

    @Test func `display summary truncates long commands`() {
        let long = String(repeating: "x", count: 2000)
        let summary = ExecApprovalHelpers.displaySummary(
            command: ["/usr/bin/echo", long],
            rawCommand: "/usr/bin/echo \(long)",
            cwd: nil)
        #expect(summary.displayCommand.count < 2000)
    }

    @Test func `display command resolves shell wrapper`() {
        let summary = ExecApprovalHelpers.displaySummary(
            command: ["/bin/sh", "-lc", "echo hello"],
            rawCommand: "echo hello",
            cwd: nil)
        #expect(summary.displayCommand == "echo hello")
    }

    @Test func `risk indicator uses severity levels`() {
        #expect(ExecApprovalHelpers.riskIndicator(for: .low) != nil)
        #expect(ExecApprovalHelpers.riskIndicator(for: .medium) != nil)
        #expect(ExecApprovalHelpers.riskIndicator(for: .high) != nil)
    }

    @Test func `truncated cwd preserves last components`() {
        let long = "/very/deeply/nested/directory/structure/with/many/components"
        let truncated = ExecApprovalHelpers.truncatedCwd(long, maxLength: 40)
        #expect(truncated.hasSuffix("components"))
        #expect(truncated.count <= 40)
    }
}
