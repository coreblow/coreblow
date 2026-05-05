import Foundation
import Testing
@testable import CoreBlow

@Suite(.serialized)
struct GatewayDiscoveryHelpersTests {
    @Test func `discovery from environment uses COREBLOW_API_BASE`() async throws {
        try await TestIsolation.withEnvValues(["COREBLOW_API_BASE": "http://localhost:3000"]) {
            let url = GatewayDiscoveryHelpers.apiBaseFromEnvironment()
            #expect(url == URL(string: "http://localhost:3000"))
        }
    }

    @Test func `discovery returns nil without environment`() async throws {
        try await TestIsolation.withEnvValues(["COREBLOW_API_BASE": ""]) {
            let url = GatewayDiscoveryHelpers.apiBaseFromEnvironment()
            #expect(url == nil)
        }
    }

    @Test func `healthcheck path construction`() {
        let base = URL(string: "http://localhost:3000")!
        let healthURL = GatewayDiscoveryHelpers.healthCheckURL(base: base)
        #expect(healthURL.path.contains("health"))
    }

    @Test func `socket URL derivation from API base`() {
        let base = URL(string: "http://localhost:3000")!
        let wsURL = GatewayDiscoveryHelpers.webSocketURL(from: base)
        #expect(wsURL.scheme == "ws" || wsURL.scheme == "wss")
    }

    @Test func `HTTPS upgrades to WSS`() {
        let base = URL(string: "https://api.example.com")!
        let wsURL = GatewayDiscoveryHelpers.webSocketURL(from: base)
        #expect(wsURL.scheme == "wss")
    }

    @Test func `HTTP stays as WS`() {
        let base = URL(string: "http://localhost:3000")!
        let wsURL = GatewayDiscoveryHelpers.webSocketURL(from: base)
        #expect(wsURL.scheme == "ws")
    }
}
