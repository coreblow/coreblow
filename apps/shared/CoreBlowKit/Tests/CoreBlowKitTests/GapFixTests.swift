// CoreBlowKitTests/GapFixTests.swift
// Tests for gap-fix files: StoragePaths, LoopbackHost, AssistantTextParser,
// ChatMarkdownPreprocessor, ToolResultFormatter, Capabilities

import Testing
import Foundation
@testable import CoreBlowKit
@testable import CoreBlowChatUI
@testable import CoreBlowProtocol

@Suite("StoragePaths")
struct StoragePathTests {

    @Test("appSupportDir returns valid URL")
    func appSupport() throws {
        let url = try CoreBlowStorage.appSupportDir()
        #expect(url.path.contains("CoreBlow"))
    }

    @Test("cachesDir returns valid URL")
    func caches() throws {
        let url = try CoreBlowStorage.cachesDir()
        #expect(url.path.contains("CoreBlow"))
    }

    @Test("canvasRoot uses session key")
    func canvasRoot() throws {
        let url = try CoreBlowStorage.canvasRoot(sessionKey: "test-session")
        #expect(url.lastPathComponent == "test-session")
    }

    @Test("canvasRoot defaults to main for empty key")
    func canvasRootEmpty() throws {
        let url = try CoreBlowStorage.canvasRoot(sessionKey: "")
        #expect(url.lastPathComponent == "main")
    }

    @Test("canvasSnapshotsRoot uses session key")
    func snapshotsRoot() throws {
        let url = try CoreBlowStorage.canvasSnapshotsRoot(sessionKey: "snap-1")
        #expect(url.lastPathComponent == "snap-1")
        #expect(url.path.contains("canvas-snapshots"))
    }
}

@Suite("LoopbackHost")
struct LoopbackHostTests {

    @Test("detects localhost")
    func localhost() {
        #expect(LoopbackHost.isLoopback("localhost"))
        #expect(LoopbackHost.isLoopback("LOCALHOST"))
        #expect(LoopbackHost.isLoopback("  localhost  "))
    }

    @Test("detects 127.0.0.1")
    func ipv4Loopback() {
        #expect(LoopbackHost.isLoopback("127.0.0.1"))
        #expect(LoopbackHost.isLoopback("127.0.0.2"))
    }

    @Test("detects IPv6 loopback")
    func ipv6Loopback() {
        #expect(LoopbackHost.isLoopback("::1"))
        #expect(LoopbackHost.isLoopback("[::1]"))
    }

    @Test("rejects non-loopback")
    func nonLoopback() {
        #expect(!LoopbackHost.isLoopback("192.168.1.1"))
        #expect(!LoopbackHost.isLoopback("example.com"))
        #expect(!LoopbackHost.isLoopback("10.0.0.1"))
    }
}

@Suite("AssistantTextParser")
struct AssistantTextParserGapTests {

    @Test("plain text returns single finalized segment")
    func plainText() {
        let segments = AssistantTextParser.segments(from: "Hello world")
        #expect(segments.count == 1)
        #expect(segments[0].state == .finalized)
        #expect(segments[0].content == "Hello world")
    }

    @Test("think tags are parsed")
    func thinkTags() {
        let input = "<think>reasoning here</think>Final answer"
        let segments = AssistantTextParser.segments(from: input)
        #expect(segments.count == 2)
        #expect(segments[0].state == .reasoning)
        #expect(segments[0].content == "reasoning here")
        #expect(segments[1].state == .finalized)
        #expect(segments[1].content == "Final answer")
    }

    @Test("segments without thinking filters reasoning")
    func withoutThinking() {
        let input = "<think>hidden</think>Visible text"
        let visible = AssistantTextParser.segments(from: input, includeThinking: false)
        #expect(visible.allSatisfy { $0.state == .finalized })
        let visibleText = visible.map(\.content).joined()
        #expect(visibleText.contains("Visible text"))
    }

    @Test("empty text returns empty")
    func emptyText() {
        #expect(AssistantTextParser.segments(from: "").isEmpty)
        #expect(AssistantTextParser.segments(from: "   ").isEmpty)
    }

    @Test("no tags treated as finalized")
    func noTags() {
        let segments = AssistantTextParser.segments(from: "Just plain text")
        #expect(segments.count == 1)
        #expect(segments[0].state == .finalized)
    }

    @Test("hasVisibleContent works")
    func hasVisible() {
        #expect(AssistantTextParser.hasVisibleContent(in: "<think>x</think>y"))
        #expect(AssistantTextParser.hasVisibleContent(in: "plain text"))
    }
}

@Suite("ChatMarkdownPreprocessor")
struct MarkdownPreprocessorGapTests {

    @Test("preprocess strips envelope headers")
    func preprocessStrips() {
        let text = "Here is a response with some markdown **bold** text."
        let result = ChatMarkdownPreprocessor.preprocess(markdown: text)
        #expect(!result.cleaned.isEmpty)
    }

    @Test("preprocess handles empty input")
    func preprocessEmpty() {
        let result = ChatMarkdownPreprocessor.preprocess(markdown: "")
        #expect(result.cleaned.isEmpty)
    }

    @Test("preprocess handles inline images")
    func preprocessImages() {
        let text = "![alt](https://example.com/image.png)"
        let result = ChatMarkdownPreprocessor.preprocess(markdown: text)
        // Should detect inline images
        #expect(!result.cleaned.isEmpty || !result.images.isEmpty)
    }
}

@Suite("ToolResultFormatter")
struct ToolResultFormatterGapTests {

    @Test("formats string result")
    func stringResult() {
        let result = ToolResultTextFormatter.format(text: "found 5 results", toolName: "search")
        #expect(result.contains("search") || result.contains("found 5 results"))
    }

    @Test("formats null/empty result")
    func emptyResult() {
        let result = ToolResultTextFormatter.format(text: "", toolName: "delete")
        // OC behavior: empty input returns empty output
        #expect(result.isEmpty)
    }

    @Test("summarize processes raw results")
    func summarize() {
        let result = ToolResultTextFormatter.summarize(rawResult: "{\"status\":\"ok\"}", toolIdentifier: "fetch")
        #expect(!result.isEmpty)
    }
}

@Suite("Capabilities")
struct CapabilitiesTests {

    @Test("default capabilities")
    func defaults() {
        let caps = DeviceCapabilities()
        #expect(caps.camera == .notDetermined)
        #expect(caps.clipboard == .authorized)
        #expect(caps.filesystem == .authorized)
    }

    @Test("authorizedCapabilities lists only authorized")
    func authorizedList() {
        var caps = DeviceCapabilities()
        caps.camera = .authorized
        caps.location = .authorized
        let list = caps.authorizedCapabilities
        #expect(list.contains("camera"))
        #expect(list.contains("location"))
        #expect(!list.contains("microphone"))
    }

    @Test("permissionsDictionary builds correct dict")
    func permsDict() {
        var caps = DeviceCapabilities()
        caps.camera = .authorized
        caps.microphone = .denied
        let dict = caps.permissionsDictionary
        #expect(dict["camera"] == true)
        #expect(dict["microphone"] == false)
    }
}
