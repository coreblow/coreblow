import Foundation
import Testing
@testable import CoreBlow

@Suite("GatewayStatusBuilder")
struct GatewayStatusBuilderTests {
    @Test func connectedWithServerName() {
        let text = GatewayStatusBuilder.statusText(connected: true, serverName: "MyGW", remoteAddress: nil, isReconnecting: false)
        #expect(text == "Connected to MyGW")
    }

    @Test func offlineStatus() {
        let text = GatewayStatusBuilder.statusText(connected: false, serverName: nil, remoteAddress: nil, isReconnecting: false)
        #expect(text == "Offline")
    }

    @Test func reconnectingOverridesAll() {
        let text = GatewayStatusBuilder.statusText(connected: true, serverName: "GW", remoteAddress: "1.2.3.4", isReconnecting: true)
        #expect(text == "Reconnecting…")
    }
}
