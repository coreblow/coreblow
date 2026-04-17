// CoreBlowKitTests/GapFixTests.swift
// Tests for all gap-fix files: StoragePaths, LoopbackHost, AssistantTextParser,
// ChatMarkdownPreprocessor, ToolResultFormatter, Capabilities, ChatTransport

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
struct AssistantTextParserTests {

    @Test("plain text returns single response segment")
    func plainText() {
        let segments = AssistantTextParser.segments(from: "Hello world")
        #expect(segments.count == 1)
        #expect(segments[0].kind == .response)
        #expect(segments[0].text == "Hello world")
    }

    @Test("think tags are parsed")
    func thinkTags() {
        let input = "<think>reasoning here</think>Final answer"
        let segments = AssistantTextParser.segments(from: input)
        #expect(segments.count == 2)
        #expect(segments[0].kind == .thinking)
        #expect(segments[0].text == "reasoning here")
        #expect(segments[1].kind == .response)
        #expect(segments[1].text == "Final answer")
    }

    @Test("visibleSegments filters thinking")
    func visibleOnly() {
        let input = "<think>hidden</think>Visible text"
        let visible = AssistantTextParser.visibleSegments(from: input)
        #expect(visible.count == 1)
        #expect(visible[0].text == "Visible text")
    }

    @Test("empty text returns empty")
    func emptyText() {
        #expect(AssistantTextParser.segments(from: "").isEmpty)
        #expect(AssistantTextParser.segments(from: "   ").isEmpty)
    }

    @Test("no tags treated as response")
    func noTags() {
        let segments = AssistantTextParser.segments(from: "Just plain text")
        #expect(segments.count == 1)
        #expect(segments[0].kind == .response)
    }

    @Test("hasVisibleContent works")
    func hasVisible() {
        #expect(AssistantTextParser.hasVisibleContent(in: "<think>x</think>y"))
        #expect(AssistantTextParser.hasVisibleContent(in: "plain text"))
    }
}

@Suite("ChatMarkdownPreprocessor")
struct MarkdownPreprocessorTests {

    @Test("extracts code blocks")
    func extractBlocks() {
        let text = """
        Here is code:
        ```python
        print("hello")
        ```
        And more text.
        """
        let blocks = ChatMarkdownPreprocessor.extractCodeBlocks(text)
        #expect(blocks.count == 1)
        #expect(blocks[0].language == "python")
        #expect(blocks[0].code.contains("print"))
    }

    @Test("splitSegments separates text and code")
    func splitSegments() {
        let text = "Before\n```js\nconsole.log('hi')\n```\nAfter"
        let segments = ChatMarkdownPreprocessor.splitSegments(text)
        #expect(segments.count == 3)
    }

    @Test("no code blocks returns single text segment")
    func noBlocks() {
        let segments = ChatMarkdownPreprocessor.splitSegments("Just text")
        #expect(segments.count == 1)
    }

    @Test("extractURLs finds links")
    func extractUrls() {
        let text = "Visit https://coreblow.com and http://example.com for more"
        let urls = ChatMarkdownPreprocessor.extractURLs(text)
        #expect(urls.count == 2)
    }
}

@Suite("ChatMarkdownRenderer")
struct MarkdownRendererTests {

    @Test("containsMarkdown detects formatting")
    func detectsMarkdown() {
        #expect(ChatMarkdownRenderer.containsMarkdown("**bold**"))
        #expect(ChatMarkdownRenderer.containsMarkdown("```code```"))
        #expect(ChatMarkdownRenderer.containsMarkdown("# Heading"))
        #expect(!ChatMarkdownRenderer.containsMarkdown("plain text"))
    }

    @Test("render returns AttributedString")
    func renders() {
        let result = ChatMarkdownRenderer.render("Hello **world**")
        #expect(!result.characters.isEmpty)
    }
}

@Suite("ToolResultFormatter")
struct ToolResultFormatterTests {

    @Test("formats string result")
    func stringResult() {
        let result = ToolResultTextFormatter.format(name: "search", result: .string("found 5 results"))
        #expect(result.contains("search"))
        #expect(result.contains("found 5 results"))
    }

    @Test("formats null result")
    func nullResult() {
        let result = ToolResultTextFormatter.format(name: "delete", result: .null)
        #expect(result.contains("done"))
    }

    @Test("formats error")
    func errorResult() {
        let result = ToolResultTextFormatter.format(name: "fetch", result: .string("timeout"), isError: true)
        #expect(result.contains("⚠️"))
    }

    @Test("oneLine compact format")
    func oneLine() {
        let result = ToolResultTextFormatter.oneLine(name: "search", result: .array([.string("a"), .string("b")]))
        #expect(result.contains("2 items"))
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

@Suite("ChatTransportError")
struct ChatTransportErrorTests {

    @Test("unsupported error message")
    func unsupported() {
        let err = CoreBlowTransportError.unsupported("sessions.reset")
        #expect(err.errorDescription == "sessions.reset not supported by this transport")
    }

    @Test("notConnected error")
    func notConnected() {
        let err = CoreBlowTransportError.notConnected
        #expect(err.errorDescription == "transport not connected")
    }
}
