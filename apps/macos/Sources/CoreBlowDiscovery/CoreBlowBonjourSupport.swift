import Foundation
import Network

// MARK: - CoreBlow Bonjour Constants

enum CoreBlowBonjour {
    static let gatewayServiceType = "_coreblow-gw._tcp"
    static let gatewayServiceDomains: [String] = ["local."]
    static var wideAreaGatewayServiceDomain: String? {
        UserDefaults.standard.string(forKey: "CoreBlowWideAreaGatewayDomain")
    }
}

// MARK: - Bonjour Escapes

enum BonjourEscapes {
    static func decode(_ name: String) -> String {
        var result = name
        result = result.replacingOccurrences(of: "\\032", with: " ")
        result = result.replacingOccurrences(of: "\\046", with: "&")
        result = result.replacingOccurrences(of: "\\092", with: "\\")
        return result
    }
}

// MARK: - Gateway Discovery Status Text

enum GatewayDiscoveryStatusText {
    static func make(
        states: [NWBrowser.State],
        hasBrowsers: Bool) -> String
    {
        if !hasBrowsers {
            return "Discovery not started"
        }
        let searching = states.filter {
            if case .ready = $0 { return true }
            return false
        }
        if searching.isEmpty {
            return "No gateways found"
        }
        return "Searching for gateways…"
    }
}

// MARK: - Gateway Endpoint ID

enum GatewayEndpointID {
    static func stableID(_ endpoint: NWEndpoint) -> String {
        switch endpoint {
        case let .service(name, type, domain, _):
            return "\(name).\(type).\(domain)"
        default:
            return endpoint.debugDescription
        }
    }

    static func prettyDescription(_ endpoint: NWEndpoint) -> String {
        switch endpoint {
        case let .service(name, type, domain, _):
            return "\(name) (\(type) in \(domain))"
        default:
            return endpoint.debugDescription
        }
    }
}

// MARK: - Gateway Discovery Browser Support

enum GatewayDiscoveryBrowserSupport {
    @Sendable
    static func makeBrowser(
        serviceType: String,
        domain: String,
        queueLabelPrefix: String,
        onState: @escaping @Sendable (NWBrowser.State) -> Void,
        onResults: @escaping @Sendable (Set<NWBrowser.Result>) -> Void) -> NWBrowser
    {
        let descriptor = NWBrowser.Descriptor.bonjour(type: serviceType, domain: domain)
        let params = NWParameters()
        let browser = NWBrowser(for: descriptor, using: params)
        let queue = DispatchQueue(label: "\(queueLabelPrefix).\(domain)")
        browser.stateUpdateHandler = { state in
            onState(state)
        }
        browser.browseResultsChangedHandler = { results, _ in
            onResults(results)
        }
        browser.start(queue: queue)
        return browser
    }
}

// MARK: - Bonjour Service Resolver Support

enum BonjourServiceResolverSupport {
    static func start(_ service: NetService, timeout: TimeInterval) {
        service.resolve(withTimeout: timeout)
    }

    static func normalizeHost(_ raw: String?) -> String? {
        guard let raw, !raw.isEmpty else { return nil }
        var host = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if host.hasSuffix(".") {
            host = String(host.dropLast())
        }
        return host.isEmpty ? nil : host
    }
}

// MARK: - Network Interface IPv4

struct NetworkInterfaceIPv4Entry {
    let name: String
    let ip: String
}

enum NetworkInterfaceIPv4 {
    static func addresses() -> [NetworkInterfaceIPv4Entry] {
        var results: [NetworkInterfaceIPv4Entry] = []
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0, let first = ifaddr else { return results }
        defer { freeifaddrs(first) }
        var current: UnsafeMutablePointer<ifaddrs>? = first
        while let ifa = current {
            let family = ifa.pointee.ifa_addr.pointee.sa_family
            if family == UInt8(AF_INET) {
                let name = String(cString: ifa.pointee.ifa_name)
                var addr = ifa.pointee.ifa_addr.withMemoryRebound(to: sockaddr_in.self, capacity: 1) { $0.pointee }
                var buffer = [CChar](repeating: 0, count: Int(INET_ADDRSTRLEN))
                inet_ntop(AF_INET, &addr.sin_addr, &buffer, socklen_t(INET_ADDRSTRLEN))
                let ip = String(cString: buffer)
                results.append(NetworkInterfaceIPv4Entry(name: name, ip: ip))
            }
            current = ifa.pointee.ifa_next
        }
        return results
    }
}
