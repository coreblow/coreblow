import Foundation
actor RemotePortTunnel { private var process: Process?; func start(localPort: UInt16, remoteHost: String, remotePort: UInt16) throws { let p = Process(); p.executableURL = URL(fileURLWithPath: "/usr/bin/ssh"); p.arguments = ["-N", "-L", "\(localPort):\(remoteHost):\(remotePort)", remoteHost]; try p.run(); process = p }; func stop() { process?.terminate(); process = nil } }
