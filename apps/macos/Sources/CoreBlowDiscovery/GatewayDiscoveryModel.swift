import Foundation
import Network
import Observation
import OSLog

/// Discovers CoreBlow gateway instances on the local network via Bonjour.
@MainActor
@Observable
public final class GatewayDiscoveryModel {
    public private(set) var isScanning = false
    public private(set) var endpoints: [DiscoveredGateway] = []
    private var browser: NWBrowser?
    private let logger = Logger(subsystem: "ai.coreblow.mac", category: "discovery")

    public struct DiscoveredGateway: Identifiable, Equatable, Sendable {
        public let id: String
        public let name: String
        public let host: String
        public let port: UInt16
        public let txtRecord: [String: String]
        public var version: Int { Int(txtRecord["v"] ?? "0") ?? 0 }
    }

    public init() {}

    public func startScan() {
        guard !isScanning else { return }
        isScanning = true
        endpoints.removeAll()
        let params = NWParameters()
        params.includePeerToPeer = true
        let browser = NWBrowser(for: .bonjour(type: "_coreblow._tcp", domain: nil), using: params)
        browser.stateUpdateHandler = { [weak self] state in
            Task { @MainActor in self?.handleBrowserState(state) }
        }
        browser.browseResultsChangedHandler = { [weak self] results, _ in
            Task { @MainActor in self?.handleResults(results) }
        }
        browser.start(queue: .main)
        self.browser = browser
    }

    public func stopScan() {
        browser?.cancel()
        browser = nil
        isScanning = false
    }

    private func handleBrowserState(_ state: NWBrowser.State) {
        switch state {
        case .failed(let error):
            logger.error("Browser failed: \(error.localizedDescription)")
            stopScan()
        case .cancelled:
            isScanning = false
        default: break
        }
    }

    private func handleResults(_ results: Set<NWBrowser.Result>) {
        var resolved: [DiscoveredGateway] = []
        for result in results {
            guard case .service(let name, let type, let domain, _) = result.endpoint else { continue }
            let txt = extractTXT(result.metadata)
            let host = txt["host"] ?? "\(name).\(domain)"
            let port = UInt16(txt["port"] ?? "0") ?? 0
            let id = "\(name)-\(type)-\(domain)"
            resolved.append(DiscoveredGateway(id: id, name: name, host: host, port: port, txtRecord: txt))
        }
        endpoints = resolved.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    private func extractTXT(_ metadata: NWBrowser.Result.Metadata?) -> [String: String] {
        guard case .bonjour(let record) = metadata else { return [:] }
        var dict: [String: String] = [:]
        for key in record.dictionary.keys {
            if let val = record.dictionary[key] { dict[key] = val }
        }
        return dict
    }
}
