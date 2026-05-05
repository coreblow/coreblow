import Foundation

struct ConnectOptions {
    let host: String; let port: UInt16; let useTLS: Bool; let token: String?
}

enum ConnectCommand {
    static func run(_ args: [String]) async throws {
        let opts = try parseArgs(args)
        let scheme = opts.useTLS ? "wss" : "ws"
        let url = URL(string: "\(scheme)://\(opts.host):\(opts.port)")!
        print("Connecting to \(url)…")
        let session = URLSession(configuration: .default)
        let ws = session.webSocketTask(with: url)
        ws.resume()
        print("Connected to \(opts.host):\(opts.port)")
        try await withCheckedThrowingContinuation { (c: CheckedContinuation<Void, Error>) in
            ws.receive { result in
                switch result {
                case .success(let msg):
                    switch msg {
                    case .string(let text): print("< \(text)")
                    case .data(let data): print("< \(data.count) bytes")
                    @unknown default: break
                    }
                    c.resume()
                case .failure(let error): c.resume(throwing: error)
                }
            }
        }
    }

    private static func parseArgs(_ args: [String]) throws -> ConnectOptions {
        var host = "localhost"; var port: UInt16 = 3000; var tls = false; var token: String?
        var i = 0
        while i < args.count {
            switch args[i] {
            case "--host", "-H": i += 1; host = try CLIArgParsingSupport.requireValue(args, at: i, for: "--host")
            case "--port", "-p": i += 1; port = UInt16(try CLIArgParsingSupport.requireValue(args, at: i, for: "--port")) ?? 3000
            case "--tls": tls = true
            case "--token": i += 1; token = try CLIArgParsingSupport.requireValue(args, at: i, for: "--token")
            default: break
            }
            i += 1
        }
        return ConnectOptions(host: host, port: port, useTLS: tls, token: token)
    }
}
