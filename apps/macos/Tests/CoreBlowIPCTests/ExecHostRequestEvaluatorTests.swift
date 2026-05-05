import Foundation
import Testing
@testable import CoreBlow

struct ExecHostRequestEvaluatorTests {
    @Test func `evaluates simple command`() async {
        let result = await ExecHostRequestEvaluator.evaluate(
            command: ["/usr/bin/echo", "hello"],
            rawCommand: "/usr/bin/echo hello",
            cwd: "/tmp",
            envOverrides: nil,
            agentId: nil)
        #expect(result.displayCommand == "/usr/bin/echo hello")
    }

    @Test func `evaluates shell wrapper command`() async {
        let result = await ExecHostRequestEvaluator.evaluate(
            command: ["/bin/sh", "-lc", "echo hello && echo world"],
            rawCommand: "echo hello && echo world",
            cwd: nil,
            envOverrides: nil,
            agentId: nil)
        #expect(result.displayCommand == "echo hello && echo world")
    }

    @Test func `evaluation includes allowlist resolutions`() async {
        let result = await ExecHostRequestEvaluator.evaluate(
            command: ["/bin/sh", "-lc", "echo hi"],
            rawCommand: "echo hi",
            cwd: nil,
            envOverrides: ["PATH": "/usr/bin:/bin"],
            agentId: nil)
        #expect(!result.allowlistResolutions.isEmpty)
        #expect(result.allowlistResolutions[0].executableName == "echo")
    }

    @Test func `nil raw command uses command array`() async {
        let result = await ExecHostRequestEvaluator.evaluate(
            command: ["/usr/bin/date"],
            rawCommand: nil,
            cwd: nil,
            envOverrides: nil,
            agentId: nil)
        #expect(result.displayCommand.contains("date"))
    }
}
