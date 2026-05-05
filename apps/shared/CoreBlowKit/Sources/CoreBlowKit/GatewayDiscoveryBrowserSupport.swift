import Foundation
import Network

public enum GatewayDiscoveryBrowserSupport {
    public static func browse(type: String = BonjourServiceType.gateway, timeout: TimeInterval = 5) async -> [(name: String, host: String, port: UInt16)] {
        await withCheckedContinuation { cont in
            let resultsBox = LockedBox<[(String, String, UInt16)]>([])
            let browser = NWBrowser(for: .bonjour(type: type, domain: nil), using: .tcp)
            browser.browseResultsChangedHandler = { newResults, _ in
                var current = resultsBox.value
                for r in newResults {
                    if case .service(let name, _, _, _) = r.endpoint {
                        current.append((name, "localhost", 3000))
                    }
                }
                resultsBox.value = current
            }
            browser.start(queue: .global())
            DispatchQueue.global().asyncAfter(deadline: .now() + timeout) {
                browser.cancel()
                cont.resume(returning: resultsBox.value)
            }
        }
    }
}

/// Thread-safe box for captured mutable state.
private final class LockedBox<T: Sendable>: @unchecked Sendable {
    private let lock = NSLock()
    private var _value: T

    init(_ value: T) { _value = value }

    var value: T {
        get { lock.withLock { _value } }
        set { lock.withLock { _value = newValue } }
    }
}
