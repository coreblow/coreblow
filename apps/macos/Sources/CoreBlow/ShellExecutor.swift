import Foundation
actor ShellExecutor {
    struct Result: Sendable { let stdout: String; let stderr: String; let exitCode: Int32 }
    func execute(command: [String], cwd: String?, env: [String: String]?, timeout: TimeInterval?) async throws -> Result {
        let p = Process(); p.executableURL = URL(fileURLWithPath: command[0]); p.arguments = Array(command.dropFirst())
        if let cwd { p.currentDirectoryURL = URL(fileURLWithPath: cwd) }
        var environ = ProcessInfo.processInfo.environment; env?.forEach { environ[$0.key] = $0.value }; p.environment = environ
        let outPipe = Pipe(); let errPipe = Pipe(); p.standardOutput = outPipe; p.standardError = errPipe
        try p.run(); p.waitUntilExit()
        return Result(stdout: String(data: outPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? "", stderr: String(data: errPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? "", exitCode: p.terminationStatus)
    }
}
