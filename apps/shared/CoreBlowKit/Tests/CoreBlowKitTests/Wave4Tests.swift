// CoreBlowKitTests/Wave4Tests.swift
// Tests for Wave 4: Bridge Frames, Commands, DeepLinks, ToolDisplay, Network

import Testing
import Foundation
@testable import CoreBlowKit
@testable import CoreBlowProtocol

@Suite("BridgeFrames")
struct BridgeFrameTests {

    @Test("BridgeInvokeRequest encode/decode")
    func invokeRoundTrip() throws {
        let req = BridgeInvokeRequest(command: "device.vibrate", paramsJSON: #"{"intensity":0.5}"#)
        let data = try JSONEncoder().encode(req)
        let decoded = try JSONDecoder().decode(BridgeInvokeRequest.self, from: data)
        #expect(decoded.command == "device.vibrate")
        #expect(decoded.paramsJSON == #"{"intensity":0.5}"#)
        #expect(decoded.type == .invoke)
    }

    @Test("BridgeHello encode")
    func helloEncode() throws {
        let hello = BridgeHello(
            nodeId: "node-123",
            displayName: "MacBook",
            platform: "macOS",
            caps: ["camera", "location"]
        )
        let data = try JSONEncoder().encode(hello)
        let json = try JSONDecoder().decode([String: FlexValue].self, from: data)
        #expect(json["type"]?.stringValue == "hello")
        #expect(json["nodeId"]?.stringValue == "node-123")
    }

    @Test("BridgePairOk decode")
    func pairOk() throws {
        let json = #"{"type":"pair-ok","token":"tok_abc"}"#
        let decoded = try JSONDecoder().decode(BridgePairOk.self, from: json.data(using: .utf8)!)
        #expect(decoded.token == "tok_abc")
        #expect(decoded.type == .pairOk)
    }

    @Test("BridgePing/Pong round-trip")
    func pingPong() throws {
        let ping = BridgePing()
        let pong = BridgePong(id: ping.id)
        #expect(ping.id == pong.id)
        #expect(ping.type == .ping)
        #expect(pong.type == .pong)
    }

    @Test("NodeError codable")
    func nodeError() throws {
        let err = NodeError(code: .invalidRequest, message: "command not available")
        let data = try JSONEncoder().encode(err)
        let decoded = try JSONDecoder().decode(NodeError.self, from: data)
        #expect(decoded == err)
    }
}

@Suite("Commands")
struct CommandTests {

    @Test("DeviceCommand raw values")
    func deviceCommands() {
        #expect(DeviceCommand.vibrate.rawValue == "device.vibrate")
        #expect(DeviceCommand.clipboard.rawValue == "device.clipboard")
        #expect(DeviceCommand.openUrl.rawValue == "device.open-url")
    }

    @Test("CameraCommand raw values")
    func cameraCommands() {
        #expect(CameraCommand.capture.rawValue == "camera.capture")
        #expect(CameraCommand.startStream.rawValue == "camera.start-stream")
    }

    @Test("LocationCommand raw values")
    func locationCommands() {
        #expect(LocationCommand.current.rawValue == "location.current")
        #expect(LocationCommand.geocode.rawValue == "location.geocode")
    }

    @Test("CanvasCommand raw values")
    func canvasCommands() {
        #expect(CanvasCommand.open.rawValue == "canvas.open")
        #expect(CanvasCommand.action.rawValue == "canvas.action")
    }

    @Test("DeviceCapability raw values")
    func capabilities() {
        #expect(DeviceCapability.camera.rawValue == "camera")
        #expect(DeviceCapability.biometrics.rawValue == "biometrics")
        #expect(DeviceCapability.canvas.rawValue == "canvas")
    }
}

@Suite("DeepLinks")
struct DeepLinkTests {

    @Test("Connect URL construction")
    func connectUrl() {
        let url = CoreBlowDeepLink.connectURL(host: "192.168.1.100", port: 3000, token: "tok")
        #expect(url != nil)
        #expect(url?.scheme == "coreblow")
        #expect(url?.absoluteString.contains("host=192.168.1.100") == true)
        #expect(url?.absoluteString.contains("port=3000") == true)
        #expect(url?.absoluteString.contains("token=tok") == true)
    }

    @Test("Chat URL construction")
    func chatUrl() {
        let url = CoreBlowDeepLink.chatURL(sessionKey: "s123", agentId: "a1")
        #expect(url != nil)
        #expect(url?.path == "/chat")
    }

    @Test("Share to agent URL")
    func shareUrl() {
        let url = CoreBlowDeepLink.shareToAgentURL(text: "Hello", agentId: "a1")
        #expect(url != nil)
        #expect(url?.absoluteString.contains("share-to-agent") == true)
    }

    @Test("Parse deep link round-trip")
    func parseRoundTrip() {
        guard let url = CoreBlowDeepLink.connectURL(host: "test.local", port: 8080) else {
            Issue.record("Failed to build URL"); return
        }
        let parsed = CoreBlowDeepLink.parse(url)
        #expect(parsed?.path == .connect)
        #expect(parsed?.params["host"] == "test.local")
        #expect(parsed?.params["port"] == "8080")
    }

    @Test("Parse non-coreblow URL returns nil")
    func parseNonCB() {
        let url = URL(string: "https://example.com/chat")!
        #expect(CoreBlowDeepLink.parse(url) == nil)
    }
}

@Suite("NetworkInterfaces")
struct NetworkInterfaceTests {

    @Test("allIPv4 returns at least loopback")
    func hasLoopback() {
        let interfaces = NetworkInterfaces.allIPv4()
        let hasLo = interfaces.contains { $0.isLoopback }
        #expect(hasLo)
    }

    @Test("loopback returns 127.0.0.1")
    func loopback() {
        #expect(NetworkInterfaces.loopback() == "127.0.0.1")
    }

    @Test("primaryIPv4 is not loopback")
    func primaryNotLoopback() {
        if let primary = NetworkInterfaces.primaryIPv4() {
            #expect(primary != "127.0.0.1")
        }
    }
}

@Suite("GatewayErrors")
struct GatewayErrorTests {

    @Test("GatewayConnectAuthError non-recoverable detection")
    func nonRecoverableAuth() {
        let err = GatewayConnectAuthError(
            message: "auth failed",
            detailCodeRaw: "AUTH_PASSWORD_MISSING"
        )
        #expect(err.isNonRecoverable == true)
        #expect(err.detail == .authPasswordMissing)
    }

    @Test("GatewayConnectAuthError recoverable")
    func recoverableAuth() {
        let err = GatewayConnectAuthError(
            message: "token mismatch",
            detailCodeRaw: "AUTH_TOKEN_MISMATCH",
            canRetryWithDeviceToken: true
        )
        #expect(err.isNonRecoverable == false)
        #expect(err.canRetryWithDeviceToken == true)
    }

    @Test("GatewayRPCError formatting")
    func rpcErrorFormat() {
        let err = GatewayRPCError(method: "send", code: "UNAVAILABLE", message: "service down")
        #expect(err.errorDescription == "send: [UNAVAILABLE] service down")
    }

    @Test("GatewayRPCError default code")
    func rpcDefaultCode() {
        let err = GatewayRPCError(method: "poll", code: nil, message: nil)
        #expect(err.code == "GATEWAY_ERROR")
        #expect(err.errorDescription == "poll: gateway error")
    }

    @Test("GatewayTimeoutError message")
    func timeoutError() {
        let err = GatewayTimeoutError("connect")
        #expect(err.errorDescription == "gateway timeout: connect")
    }
}
