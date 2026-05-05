import Foundation
import Testing
@testable import CoreBlow

@Suite("GatewayEndpointID")
struct GatewayEndpointIDTests {
    @Test func stableIDFromHostAndPort() {
        let config = GatewayConnectConfig(host: "192.168.1.10", port: 8080)
        let id = config.stableID
        #expect(!id.isEmpty)
        #expect(id == GatewayConnectConfig(host: "192.168.1.10", port: 8080).stableID)
    }

    @Test func differentPortYieldsDifferentID() {
        let a = GatewayConnectConfig(host: "10.0.0.1", port: 8080)
        let b = GatewayConnectConfig(host: "10.0.0.1", port: 9090)
        #expect(a.stableID != b.stableID)
    }
}
