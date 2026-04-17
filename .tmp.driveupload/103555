// CoreBlowKitTests/Wave6Tests.swift
// Tests for Wave 6: NodeSession, Security, Canvas, Talk

import Testing
import Foundation
@testable import CoreBlowKit
@testable import CoreBlowProtocol

@Suite("CanvasA2UI")
struct CanvasActionTests {

    @Test("CanvasAction encode/decode")
    func actionRoundTrip() throws {
        let action = CanvasAction(
            kind: .update,
            target: "#main",
            data: .object(["text": .string("hello")])
        )
        let data = try JSONEncoder().encode(action)
        let decoded = try JSONDecoder().decode(CanvasAction.self, from: data)
        #expect(decoded.kind == .update)
        #expect(decoded.target == "#main")
        #expect(decoded.data?["text"]?.stringValue == "hello")
    }

    @Test("CanvasActionKind raw values")
    func actionKinds() {
        #expect(CanvasActionKind.navigate.rawValue == "navigate")
        #expect(CanvasActionKind.setData.rawValue == "set-data")
        #expect(CanvasActionKind.mergeData.rawValue == "merge-data")
        #expect(CanvasActionKind.showAlert.rawValue == "show-alert")
    }

    @Test("JSONL parse")
    func jsonlParse() {
        let jsonl = """
        {"actionId":"1","kind":"update","target":"#a"}
        {"actionId":"2","kind":"clear"}
        """
        let actions = CanvasJSONLParser.parse(jsonl)
        #expect(actions.count == 2)
        #expect(actions[0].kind == .update)
        #expect(actions[0].target == "#a")
        #expect(actions[1].kind == .clear)
    }

    @Test("JSONL encode round-trip")
    func jsonlEncode() {
        let actions = [
            CanvasAction(kind: .navigate, target: "/home"),
            CanvasAction(kind: .showToast, data: .string("saved")),
        ]
        let encoded = CanvasJSONLParser.encode(actions)
        let decoded = CanvasJSONLParser.parse(encoded)
        #expect(decoded.count == 2)
        #expect(decoded[0].kind == .navigate)
        #expect(decoded[1].kind == .showToast)
    }

    @Test("CanvasOpenParams")
    func openParams() throws {
        let params = CanvasOpenParams(url: "https://example.com", title: "Test", width: 800, height: 600)
        let data = try JSONEncoder().encode(params)
        let decoded = try JSONDecoder().decode(CanvasOpenParams.self, from: data)
        #expect(decoded.url == "https://example.com")
        #expect(decoded.width == 800)
    }
}

@Suite("CanvasURLHelpers")
struct CanvasURLTests {

    @Test("replaceCanvasCapability substitutes correctly")
    func replaceCapability() {
        let url = "https://example.com/__coreblow__/cap/old-cap/page?q=1"
        let result = replaceCanvasCapability(in: url, with: "new-cap")
        #expect(result == "https://example.com/__coreblow__/cap/new-cap/page?q=1")
    }

    @Test("replaceCanvasCapability returns nil without marker")
    func noMarker() {
        #expect(replaceCanvasCapability(in: "https://example.com/page", with: "cap") == nil)
    }

    @Test("canonicalizeCanvasHostUrl handles loopback")
    func canonicalizeLoopback() {
        let result = canonicalizeCanvasHostUrl(raw: "http://localhost:3000/canvas", activeURL: nil)
        #expect(result == "http://localhost:3000/canvas")
    }

    @Test("canonicalizeCanvasHostUrl inherits host from activeURL")
    func canonicalizeInherit() {
        let active = URL(string: "wss://gateway.example.com:443/ws")!
        let result = canonicalizeCanvasHostUrl(raw: "http://localhost:3000/canvas", activeURL: active)
        #expect(result?.contains("gateway.example.com") == true)
        #expect(result?.hasPrefix("https://") == true)
    }

    @Test("canonicalizeCanvasHostUrl nil for empty")
    func canonicalizeEmpty() {
        #expect(canonicalizeCanvasHostUrl(raw: nil, activeURL: nil) == nil)
        #expect(canonicalizeCanvasHostUrl(raw: "", activeURL: nil) == nil)
        #expect(canonicalizeCanvasHostUrl(raw: "   ", activeURL: nil) == nil)
    }
}

@Suite("TLSPinning")
struct TLSPinningTests {

    @Test("normalizeFingerprint strips prefix and lowercases")
    func normalize() {
        let raw = "SHA-256: AB:CD:EF:12"
        let result = TLSPinningSession.normalizeFingerprint(raw)
        #expect(result == "abcdef12")
    }

    @Test("normalizeFingerprint handles clean input")
    func normalizeClean() {
        let result = TLSPinningSession.normalizeFingerprint("abcdef1234567890")
        #expect(result == "abcdef1234567890")
    }

    @Test("TLSPinningParams defaults")
    func paramsDefaults() {
        let params = TLSPinningParams()
        #expect(params.required == false)
        #expect(params.allowTOFU == true)
        #expect(params.expectedFingerprint == nil)
    }
}

@Suite("KeychainStore")
struct KeychainStoreTests {

    @Test("save and load string")
    func saveLoad() {
        let service = "com.coreblow.test"
        let account = "test-\(UUID().uuidString.prefix(8))"
        let value = "test-secret-\(UUID().uuidString)"

        KeychainStore.saveString(value, service: service, account: account)
        let loaded = KeychainStore.loadString(service: service, account: account)
        #expect(loaded == value)

        // Cleanup
        KeychainStore.delete(service: service, account: account)
        #expect(KeychainStore.loadString(service: service, account: account) == nil)
    }

    @Test("exists check")
    func existsCheck() {
        let service = "com.coreblow.test"
        let account = "exists-\(UUID().uuidString.prefix(8))"

        #expect(KeychainStore.exists(service: service, account: account) == false)
        KeychainStore.saveString("val", service: service, account: account)
        #expect(KeychainStore.exists(service: service, account: account) == true)

        // Cleanup
        KeychainStore.delete(service: service, account: account)
    }
}

@Suite("TalkEngine")
struct TalkEngineTests {

    @Test("availableVoices returns non-empty list")
    func voices() {
        let voices = TalkEngine.availableVoices()
        #expect(!voices.isEmpty)
    }

    @Test("TalkDirective codable")
    func directiveCodable() throws {
        let directive = TalkDirective(text: "Hello CoreBlow", voiceId: "com.apple.voice.compact.en-US.Samantha", rate: 0.5)
        let data = try JSONEncoder().encode(directive)
        let decoded = try JSONDecoder().decode(TalkDirective.self, from: data)
        #expect(decoded.text == "Hello CoreBlow")
        #expect(decoded.rate == 0.5)
    }

    @Test("TalkVoice codable")
    func voiceCodable() throws {
        let voice = TalkVoice(identifier: "test", name: "Test Voice", language: "en-US", quality: "enhanced")
        let data = try JSONEncoder().encode(voice)
        let decoded = try JSONDecoder().decode(TalkVoice.self, from: data)
        #expect(decoded.name == "Test Voice")
        #expect(decoded.quality == "enhanced")
    }
}
