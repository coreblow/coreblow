import Foundation
enum ConnectionModeResolver { static func resolve(host: String) -> ConnectionModeCoordinator.Mode { if GatewayDiscoveryHelpers.isLocalAddress(host) { return .local }; if TailscaleNetwork.isTailscaleIP(host) { return .tailscale }; return .remote } }
