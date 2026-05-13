import Foundation; import Network
public enum BonjourServiceResolverSupport {
    public static func start(_ service: NetService, timeout: TimeInterval = 2.0) {
        service.schedule(in: .main, forMode: .common)
        service.resolve(withTimeout: timeout)
    }

    public static func normalizeHost(_ raw: String?) -> String? {
        let trimmed = raw?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !trimmed.isEmpty else { return nil }
        return trimmed.hasSuffix(".") ? String(trimmed.dropLast()) : trimmed
    }

    public static func resolve(name: String, type: String, domain: String, timeout: TimeInterval = 5) async -> (host: String, port: UInt16)? {
        await withCheckedContinuation { cont in
            let conn = NWConnection(to: .service(name: name, type: type, domain: domain, interface: nil), using: .tcp)
            conn.stateUpdateHandler = { state in
                if case .ready = state, let endpoint = conn.currentPath?.remoteEndpoint, case .hostPort(let host, let port) = endpoint { cont.resume(returning: ("\(host)", port.rawValue)); conn.cancel() }
            }
            conn.start(queue: .global())
            DispatchQueue.global().asyncAfter(deadline: .now() + timeout) { cont.resume(returning: nil); conn.cancel() }
        }
    }
}
