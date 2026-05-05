import Foundation
enum LaunchdManager { static func isServiceRunning(_ label: String) -> Bool { let p = Process(); p.executableURL = URL(fileURLWithPath: "/bin/launchctl"); p.arguments = ["list", label]; let pipe = Pipe(); p.standardOutput = pipe; p.standardError = pipe; try? p.run(); p.waitUntilExit(); return p.terminationStatus == 0 } }
