import Foundation
import Testing
@testable import CoreBlow

@Suite(.serialized)
struct ConfigStoreTests {
    @Test func `reads default config values`() {
        let store = ConfigStore()
        #expect(store.gatewayMode != nil)
    }

    @Test func `overrides config from dictionary`() {
        var store = ConfigStore()
        store.apply(configRoot: ["gateway": ["mode": "remote"]])
        #expect(store.gatewayMode == .remote)
    }

    @Test func `preserves unset values on partial update`() {
        var store = ConfigStore()
        let original = store.gatewayMode
        store.apply(configRoot: ["unrelated": ["key": "value"]])
        #expect(store.gatewayMode == original)
    }

    @Test func `local mode is default`() {
        let store = ConfigStore()
        #expect(store.gatewayMode == .local)
    }

    @Test func `resets to defaults`() {
        var store = ConfigStore()
        store.apply(configRoot: ["gateway": ["mode": "remote"]])
        store.reset()
        #expect(store.gatewayMode == .local)
    }
}
