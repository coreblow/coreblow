import Foundation; import Network
public enum GatewayDiscoveryBrowserSupport {
    public static func browse(type: String = BonjourServiceType.gateway, timeout: TimeInterval = 5) async -> [(name: String, host: String, port: UInt16)] {
        await withCheckedContinuation { cont in
            var results: [(String, String, UInt16)] = []
            let browser = NWBrowser(for: .bonjour(type: type, domain: nil), using: .tcp)
            browser.browseResultsChangedHandler = { newResults, _ in
                for r in newResults { if case .service(let name, _, _, _) = r.endpoint { results.append((name, "localhost", 3000)) } }
            }
            browser.start(queue: .global())
            DispatchQueue.global().asyncAfter(deadline: .now() + timeout) { browser.cancel(); cont.resume(returning: results) }
        }
    }
}
