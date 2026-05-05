import Foundation
import Testing
@testable import CoreBlow

@Suite("KeychainStore")
struct KeychainStoreTests {
    @Test func saveAndRetrieveToken() {
        let store = KeychainStore()
        let token = "test-token-\(UUID().uuidString)"
        store.saveToken(token, forGateway: "test-gw")
        let loaded = store.loadToken(forGateway: "test-gw")
        #expect(loaded == token)
        store.deleteToken(forGateway: "test-gw")
    }

    @Test func deleteRemovesToken() {
        let store = KeychainStore()
        store.saveToken("temp", forGateway: "del-gw")
        store.deleteToken(forGateway: "del-gw")
        #expect(store.loadToken(forGateway: "del-gw") == nil)
    }
}
