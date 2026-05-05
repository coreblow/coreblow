import Foundation
import Combine
import Network
import os.log

/// Discovers CoreBlow gateways on the local network via Bonjour/mDNS.
final class GatewayDiscoveryModel: ObservableObject {

    // MARK: - Published

    @Published private(set) var discoveredEndpoints: [GatewayConnectConfig] = []
    @Published private(set) var isScanning = false
    @Published private(set) var logEntries: [DiscoveryLogEntry] = []

    // MARK: - Private

    private let logger = Logger(subsystem: "ai.coreblow.app", category: "GatewayDiscovery")
    private var browser: NWBrowser?
    private let serviceType = "_coreblow._tcp"

    // MARK: - Scanning

    func startScan() {
        guard !isScanning else { return }
        isScanning = true
        discoveredEndpoints = []
        addLog("Starting Bonjour scan for \(serviceType)", level: .info)

        let params = NWParameters()
        params.includePeerToPeer = true
        let browser = NWBrowser(for: .bonjour(type: serviceType, domain: "local."), using: params)

        browser.stateUpdateHandler = { [weak self] state in
            DispatchQueue.main.async {
                switch state {
                case .ready:
                    self?.addLog("Browser ready", level: .info)
                case .failed(let error):
                    self?.addLog("Browser failed: \(error)", level: .error)
                    self?.stopScan()
                default:
                    break
                }
            }
        }

        browser.browseResultsChangedHandler = { [weak self] results, _ in
            DispatchQueue.main.async {
                self?.handleResults(results)
            }
        }

        browser.start(queue: .main)
        self.browser = browser
        logger.info("Bonjour scan started")
    }

    func stopScan() {
        browser?.cancel()
        browser = nil
        isScanning = false
        addLog("Scan stopped", level: .info)
    }

    func clearLog() {
        logEntries.removeAll()
    }

    // MARK: - Private

    private func handleResults(_ results: Set<NWBrowser.Result>) {
        for result in results {
            if case .service(let name, let type, let domain, _) = result.endpoint {
                addLog("Found: \(name) (\(type).\(domain))", level: .info)

                let config = GatewayConnectConfig(
                    host: name,
                    port: 8080,
                    displayName: name,
                    source: .bonjour
                )

                if !discoveredEndpoints.contains(where: { $0.stableID == config.stableID }) {
                    discoveredEndpoints.append(config)
                }
            }
        }
    }

    private func addLog(_ message: String, level: DiscoveryLogEntry.Level) {
        let entry = DiscoveryLogEntry(message: message, level: level)
        logEntries.append(entry)
        if logEntries.count > 200 { logEntries.removeFirst() }
    }
}

// MARK: - Log Entry

struct DiscoveryLogEntry: Identifiable {
    let id = UUID()
    let timestamp = Date()
    let message: String
    let level: Level

    enum Level {
        case info, warning, error

        var color: SwiftUI.Color {
            switch self {
            case .info: return .green
            case .warning: return .yellow
            case .error: return .red
            }
        }
    }
}
