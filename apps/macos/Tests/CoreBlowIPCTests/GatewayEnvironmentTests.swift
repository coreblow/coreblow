import Foundation
import Testing
@testable import CoreBlow

@Suite(.serialized)
struct GatewayEnvironmentTests {
    @Test func `reads API base from environment`() async throws {
        try await TestIsolation.withEnvValues(["COREBLOW_API_BASE": "http://localhost:4567"]) {
            let env = GatewayEnvironment.current()
            #expect(env.apiBase == URL(string: "http://localhost:4567"))
        }
    }

    @Test func `reads auth token from environment`() async throws {
        try await TestIsolation.withEnvValues(["COREBLOW_AUTH_TOKEN": "test-token-123"]) {
            let env = GatewayEnvironment.current()
            #expect(env.authToken == "test-token-123")
        }
    }

    @Test func `nil when environment not set`() async throws {
        try await TestIsolation.withEnvValues(["COREBLOW_API_BASE": "", "COREBLOW_AUTH_TOKEN": ""]) {
            let env = GatewayEnvironment.current()
            #expect(env.apiBase == nil)
            #expect(env.authToken == nil)
        }
    }

    @Test func `reads project root from environment`() async throws {
        try await TestIsolation.withEnvValues(["COREBLOW_PROJECT_ROOT": "/tmp/test-project"]) {
            let env = GatewayEnvironment.current()
            #expect(env.projectRoot == "/tmp/test-project")
        }
    }
}
