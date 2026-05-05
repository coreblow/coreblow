import Foundation
enum GatewayDiscoverySelectionSupport { static func selectBest(from endpoints: [GatewayEndpointRecord]) -> GatewayEndpointRecord? { endpoints.sorted { ($0.lastConnected ?? .distantPast) > ($1.lastConnected ?? .distantPast) }.first } }
