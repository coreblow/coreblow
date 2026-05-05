import Foundation
import Testing
@testable import CoreBlow

@Suite("GatewaySettingsStore")
struct GatewaySettingsStoreTests {
    @Test func saveAndLoadGatewayURL() {
        let store = GatewaySettingsStore()
        let config = GatewayConnectConfig(host: "test.local", port: 8080)
        store.saveLastGateway(config)
        let loaded = store.loadLastGateway()
        #expect(loaded?.host == "test.local")
        #expect(loaded?.port == 8080)
    }

    @Test func clearRemovesStoredConfig() {
        let store = GatewaySettingsStore()
        store.saveLastGateway(GatewayConnectConfig(host: "a.local", port: 1234))
        store.clearLastGateway()
        #expect(store.loadLastGateway() == nil)
    }
}
