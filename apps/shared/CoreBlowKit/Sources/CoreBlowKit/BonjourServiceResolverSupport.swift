import Foundation; import Network
public enum BonjourServiceResolverSupport {
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
