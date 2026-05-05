import Foundation
enum RemoteGatewayProbe { static func probe(host: String, port: UInt16, tls: Bool) async -> Bool { let scheme = tls ? "https" : "http"; guard let url = URL(string: "\(scheme)://\(host):\(port)/health") else { return false }; do { let (_, resp) = try await URLSession.shared.data(from: url); return (resp as? HTTPURLResponse)?.statusCode == 200 } catch { return false } } }
