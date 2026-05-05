import Foundation
import CoreBlowKit
import Testing
@testable import CoreBlow

@Suite(.serialized)
struct GatewayChannelConnectTests {
    private func makeSession(response: GatewayTestWebSocketTask.ConnectResponse = .helloOk(delayMs: 0))
        -> GatewayTestWebSocketSession
    {
        GatewayTestWebSocketSession(
            taskFactory: {
                GatewayTestWebSocketTask(
                    receiveHook: { task, receiveIndex in
                        guard receiveIndex == 0 else {
                            return .data(GatewayWebSocketTestSupport.connectChallengeData())
                        }
                        let delayMs: Int
                        let message: URLSessionWebSocketTask.Message
                        switch response {
                        case let .helloOk(ms):
                            delayMs = ms
                            let id = task.snapshotConnectRequestID() ?? "connect"
                            message = .data(GatewayWebSocketTestSupport.connectOkData(id: id))
                        case let .invalid(ms):
                            delayMs = ms
                            message = .string("not json")
                        case let .authFailed(ms, detailCode, canRetryWithDeviceToken, recommendedNextStep):
                            delayMs = ms
                            let id = task.snapshotConnectRequestID() ?? "connect"
                            message = .data(GatewayWebSocketTestSupport.connectAuthFailureData(
                                id: id,
                                detailCode: detailCode,
                                canRetryWithDeviceToken: canRetryWithDeviceToken,
                                recommendedNextStep: recommendedNextStep))
                        }
                        try await Task.sleep(nanoseconds: UInt64(delayMs) * 1_000_000)
                        return message
                    })
            })
    }

    @Test func `concurrent connect is single flight on success`() async throws {
        let session = makeSession(response: .helloOk(delayMs: 200))
        let channel = try GatewayChannelActor(
            url: #require(URL(string: "ws://example.invalid")),
            token: nil,
            session: WebSocketSessionBox(session: session))

        let t1 = Task { try await channel.connect() }
        let t2 = Task { try await channel.connect() }

        _ = try await t1.value
        _ = try await t2.value

        #expect(session.snapshotMakeCount() == 1)
    }

    @Test func `concurrent connect shares failure`() async throws {
        let session = makeSession(response: .invalid(delayMs: 200))
        let channel = try GatewayChannelActor(
            url: #require(URL(string: "ws://example.invalid")),
            token: nil,
            session: WebSocketSessionBox(session: session))

        let t1 = Task { try await channel.connect() }
        let t2 = Task { try await channel.connect() }

        let r1 = await t1.result
        let r2 = await t2.result

        #expect({
            if case .failure = r1 { true } else { false }
        }())
        #expect({
            if case .failure = r2 { true } else { false }
        }())
        #expect(session.snapshotMakeCount() == 1)
    }

    @Test func `connect surfaces structured auth failure`() async throws {
        let session = makeSession(response: .authFailed(
            delayMs: 0,
            detailCode: GatewayConnectAuthDetailCode.authTokenMissing.rawValue,
            canRetryWithDeviceToken: true,
            recommendedNextStep: GatewayConnectRecoveryNextStep.updateAuthConfiguration.rawValue))
        let channel = try GatewayChannelActor(
            url: #require(URL(string: "ws://example.invalid")),
            token: nil,
            session: WebSocketSessionBox(session: session))

        do {
            try await channel.connect()
            Issue.record("expected GatewayConnectAuthError")
        } catch let error as GatewayConnectAuthError {
            #expect(error.detail == .authTokenMissing)
            #expect(error.detailCode == GatewayConnectAuthDetailCode.authTokenMissing.rawValue)
            #expect(error.canRetryWithDeviceToken)
            #expect(error.recommendedNextStep == .updateAuthConfiguration)
            #expect(error.recommendedNextStepCode == GatewayConnectRecoveryNextStep.updateAuthConfiguration.rawValue)
        } catch {
            Issue.record("unexpected error: \(error)")
        }
    }
}
