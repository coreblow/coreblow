// CoreBlowKitTests/FlexValueTests.swift
// Tests for CoreBlowProtocol's FlexValue type.

import Testing
import Foundation
@testable import CoreBlowProtocol

@Suite("FlexValue")
struct FlexValueTests {

    // MARK: - Literal Construction

    @Test("Boolean literal")
    func boolLiteral() {
        let v: FlexValue = true
        #expect(v.boolValue == true)
        #expect(v.coercedString == "true")
    }

    @Test("Integer literal")
    func intLiteral() {
        let v: FlexValue = 42
        #expect(v.intValue == 42)
        #expect(v.doubleValue == 42.0)
    }

    @Test("Double literal")
    func doubleLiteral() {
        let v: FlexValue = 3.14
        #expect(v.doubleValue == 3.14)
        #expect(v.intValue == nil) // 3.14 is not exactly Int
    }

    @Test("String literal")
    func stringLiteral() {
        let v: FlexValue = "hello"
        #expect(v.stringValue == "hello")
    }

    @Test("Nil literal")
    func nilLiteral() {
        let v: FlexValue = nil
        #expect(v.isNull)
        #expect(v.coercedBool == false)
    }

    @Test("Array literal")
    func arrayLiteral() {
        let v: FlexValue = [1, "two", true]
        #expect(v.arrayValue?.count == 3)
        #expect(v[0]?.intValue == 1)
        #expect(v[1]?.stringValue == "two")
        #expect(v[2]?.boolValue == true)
    }

    @Test("Dictionary literal")
    func dictLiteral() {
        let v: FlexValue = ["name": "CoreBlow", "version": 3]
        #expect(v["name"]?.stringValue == "CoreBlow")
        #expect(v["version"]?.intValue == 3)
    }

    // MARK: - Dynamic Member Lookup

    @Test("Dynamic member lookup on object")
    func dynamicMember() {
        let v: FlexValue = ["userId": "abc", "age": 25]
        #expect(v.userId?.stringValue == "abc")
        #expect(v.age?.intValue == 25)
        #expect(v.missing == nil)
    }

    @Test("Dynamic member on non-object returns nil")
    func dynamicMemberNonObject() {
        let v: FlexValue = "just a string"
        #expect(v.anything == nil)
    }

    // MARK: - Codable Round-Trip

    @Test("JSON encode/decode round-trip")
    func codableRoundTrip() throws {
        let original: FlexValue = [
            "name": "test",
            "count": 42,
            "pi": 3.14,
            "active": true,
            "tags": ["a", "b"],
            "nested": ["x": 1],
        ]
        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(FlexValue.self, from: data)
        #expect(decoded == original)
    }

    @Test("Null round-trip")
    func nullRoundTrip() throws {
        let original: FlexValue = .null
        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(FlexValue.self, from: data)
        #expect(decoded.isNull)
    }

    @Test("Decode from raw JSON string")
    func decodeRawJSON() throws {
        let json = #"{"ok":true,"count":7,"label":"CoreBlow"}"#
        let data = json.data(using: .utf8)!
        let flex = try JSONDecoder().decode(FlexValue.self, from: data)
        #expect(flex["ok"]?.boolValue == true)
        #expect(flex["count"]?.intValue == 7)
        #expect(flex["label"]?.stringValue == "CoreBlow")
    }

    // MARK: - Coercion

    @Test("String coercion")
    func coercion() {
        #expect(FlexValue.int(42).coercedString == "42")
        #expect(FlexValue.bool(false).coercedString == "false")
        #expect(FlexValue.null.coercedString == "")
    }

    @Test("Bool coercion")
    func boolCoercion() {
        #expect(FlexValue.int(1).coercedBool == true)
        #expect(FlexValue.int(0).coercedBool == false)
        #expect(FlexValue.string("yes").coercedBool == true)
        #expect(FlexValue.string("no").coercedBool == false)
        #expect(FlexValue.null.coercedBool == false)
    }

    // MARK: - Loose Equality

    @Test("Loose equality across types")
    func looseEquality() {
        #expect(FlexValue.int(42).looselyEquals(.string("42")))
        #expect(FlexValue.int(1).looselyEquals(.double(1.0)))
        #expect(!FlexValue.int(42).looselyEquals(.string("43")))
    }

    // MARK: - Hashable

    @Test("Same values hash equally")
    func hashEquality() {
        let a: FlexValue = ["key": "value"]
        let b: FlexValue = ["key": "value"]
        #expect(a.hashValue == b.hashValue)
    }

    // MARK: - From Any

    @Test("Construct from heterogeneous Any")
    func fromAny() {
        let dict: [String: Any] = ["name": "test", "count": 42, "active": true]
        let flex = FlexValue.from(dict)
        #expect(flex["name"]?.stringValue == "test")
        #expect(flex["count"]?.intValue == 42)
        #expect(flex["active"]?.boolValue == true)
    }
}

@Suite("GatewayFrames")
struct GatewayFrameTests {

    @Test("Request frame encode/decode")
    func requestRoundTrip() throws {
        let req = GatewayRequest(method: "connect", params: ["role": "operator"])
        let data = try req.jsonData()
        let frame = try GatewayFrame.decode(from: data)
        guard case .request(let decoded) = frame else {
            Issue.record("Expected request frame")
            return
        }
        #expect(decoded.method == "connect")
        #expect(decoded.params?["role"]?.stringValue == "operator")
    }

    @Test("Response frame decode")
    func responseDecode() throws {
        let json = #"{"type":"res","id":"abc","ok":true,"payload":{"protocol":3}}"#
        let frame = try GatewayFrame.decode(from: json.data(using: .utf8)!)
        guard case .response(let res) = frame else {
            Issue.record("Expected response frame")
            return
        }
        #expect(res.ok == true)
        #expect(res.payload?["protocol"]?.intValue == 3)
    }

    @Test("Event frame decode")
    func eventDecode() throws {
        let json = #"{"type":"evt","event":"tick","seq":5}"#
        let frame = try GatewayFrame.decode(from: json.data(using: .utf8)!)
        guard case .event(let evt) = frame else {
            Issue.record("Expected event frame")
            return
        }
        #expect(evt.event == "tick")
        #expect(evt.seq == 5)
        #expect(frame.isTick)
    }

    @Test("Connect challenge detection")
    func connectChallenge() throws {
        let json = #"{"type":"evt","event":"connect.challenge","payload":{"nonce":"abc123"}}"#
        let frame = try GatewayFrame.decode(from: json.data(using: .utf8)!)
        #expect(frame.isConnectChallenge)
        guard case .event(let evt) = frame else { return }
        #expect(evt.payload?["nonce"]?.stringValue == "abc123")
    }

    @Test("Error response parsing")
    func errorResponse() throws {
        let json = """
        {"type":"res","id":"x","ok":false,"error":{
            "message":"auth failed",
            "details":{"code":"auth_token_mismatch"}
        }}
        """
        let frame = try GatewayFrame.decode(from: json.data(using: .utf8)!)
        guard case .response(let res) = frame else {
            Issue.record("Expected response")
            return
        }
        #expect(res.ok == false)
        #expect(res.errorMessage == "auth failed")
        #expect(res.errorDetailCode == "auth_token_mismatch")
    }
}

@Suite("GatewayModels")
struct GatewayModelTests {

    @Test("ConnectParams encode")
    func connectParams() throws {
        let params = ConnectParams(
            minprotocol: COREBLOW_PROTOCOL_VERSION,
            maxprotocol: COREBLOW_PROTOCOL_VERSION,
            client: ["id": AnyCodable("coreblow-ios"), "version": AnyCodable("1.0")],
            caps: nil,
            commands: nil,
            permissions: nil,
            pathenv: nil,
            role: "operator",
            scopes: ["operator.admin"],
            device: nil,
            auth: nil,
            locale: nil,
            useragent: nil
        )
        let data = try JSONEncoder().encode(params)
        let decoded = try JSONDecoder().decode(ConnectParams.self, from: data)
        #expect(decoded.minprotocol == COREBLOW_PROTOCOL_VERSION)
        #expect(decoded.role == "operator")
    }

    @Test("HelloOkPayload tickInterval extraction")
    func helloOkTickInterval() throws {
        let json = """
        {
            "tickIntervalMs": 15000
        }
        """
        let payload = try JSONDecoder().decode(HelloOkPayload.self, from: json.data(using: .utf8)!)
        #expect(payload.tickIntervalMs == 15000.0)
        #expect(payload.canvasHostUrl == nil)
    }

    @Test("PresenceEntry decode")
    func presenceEntry() throws {
        let json = """
        {"host":"Mac","platform":"macOS","ts":1234567890,"deviceId":"abc","deviceFamily":"desktop"}
        """
        let entry = try JSONDecoder().decode(PresenceEntry.self, from: json.data(using: .utf8)!)
        #expect(entry.host == "Mac")
        #expect(entry.platform == "macOS")
        #expect(entry.deviceid == "abc")
        #expect(entry.devicefamily == "desktop")
    }

    @Test("WizardStep decode and helpers")
    func wizardStep() {
        let raw: [String: FlexValue] = [
            "type": "select",
            "title": "Choose Provider",
            "status": "  Active  ",
        ]
        let step = decodeWizardStep(from: raw)
        #expect(step?.typeString == "select")
        #expect(step?.statusString == "active")
    }

    @Test("WizardOption parsing")
    func wizardOptions() {
        let raw: [[String: FlexValue]] = [
            ["value": "openai", "label": "OpenAI", "hint": "GPT models"],
            ["value": "anthropic", "label": "Anthropic"],
        ]
        let options = parseWizardOptions(from: raw)
        #expect(options.count == 2)
        #expect(options[0].label == "OpenAI")
        #expect(options[0].hint == "GPT models")
        #expect(options[1].hint == nil)
    }
}


@Suite("GatewayEnums")
struct GatewayEnumTests {

    @Test("ErrorCode raw values")
    func errorCodes() {
        #expect(GatewayErrorCode.notLinked.rawValue == "NOT_LINKED")
        #expect(GatewayErrorCode.rateLimited.rawValue == "RATE_LIMITED")
    }

    @Test("ConnectAuthDetailCode from raw string")
    func authDetailCode() {
        let code = ConnectAuthDetailCode(rawValue: "auth_token_mismatch")
        #expect(code == .authTokenMismatch)
    }

    @Test("FrameKind raw values match wire protocol")
    func frameKind() {
        #expect(FrameKind.request.rawValue == "req")
        #expect(FrameKind.response.rawValue == "res")
        #expect(FrameKind.event.rawValue == "evt")
    }

    @Test("RPCMethod values")
    func rpcMethods() {
        #expect(RPCMethod.connect.rawValue == "connect")
        #expect(RPCMethod.sessionsList.rawValue == "sessions.list")
        #expect(RPCMethod.nodePairApprove.rawValue == "node.pair.approve")
    }

    @Test("AuthMode decode from JSON")
    func authModeDecode() throws {
        let json = #""trusted-proxy""#
        let mode = try JSONDecoder().decode(AuthMode.self, from: json.data(using: .utf8)!)
        #expect(mode == .trustedProxy)
    }
}
