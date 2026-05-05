import Foundation
import CoreBlowKit
import Testing
@testable import CoreBlow

@Suite(.serialized)
struct GatewayChannelConfigureTests {
    @Test func `configure creates channel from URL`() async throws {
        let url = try #require(URL(string: "ws://localhost:3000/ws"))
        let channel = try GatewayChannelActor(
            url: url,
            token: nil,
            session: WebSocketSessionBox(session: GatewayTestWebSocketSession()))
        #expect(await channel.url == url)
    }

    @Test func `configure with auth token`() async throws {
        let url = try #require(URL(string: "ws://localhost:3000/ws"))
        let channel = try GatewayChannelActor(
            url: url,
            token: "test-auth-token",
            session: WebSocketSessionBox(session: GatewayTestWebSocketSession()))
        #expect(await channel.token == "test-auth-token")
    }

    @Test func `configure multiple channels independently`() async throws {
        let url1 = try #require(URL(string: "ws://localhost:3001/ws"))
        let url2 = try #require(URL(string: "ws://localhost:3002/ws"))
        let session = GatewayTestWebSocketSession()

        let ch1 = try GatewayChannelActor(
            url: url1, token: nil,
            session: WebSocketSessionBox(session: session))
        let ch2 = try GatewayChannelActor(
            url: url2, token: "token-2",
            session: WebSocketSessionBox(session: session))

        #expect(await ch1.url != await ch2.url)
    }
}
