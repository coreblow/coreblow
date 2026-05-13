import Testing
@testable import CoreBlowKit
@testable import CoreBlowChatUI

@Suite("AssistantTextParser Core")
struct AssistantTextParserCoreTests {
    @Test("segment returns finalized for plain text")
    func segmentPlain() {
        let segments = CoreBlowMessageSegmenter.segment(rawText: "Hello world")
        #expect(segments.count == 1)
        #expect(segments[0].state == .finalized)
        #expect(segments[0].content == "Hello world")
    }

    @Test("segment handles think tags")
    func segmentThinkTags() {
        let segments = CoreBlowMessageSegmenter.segment(rawText: "<think>reason</think>answer")
        #expect(segments.count == 2)
        #expect(segments[0].state == .reasoning)
        #expect(segments[1].state == .finalized)
    }

    @Test("containsContent detects non-empty text")
    func containsContent() {
        #expect(CoreBlowMessageSegmenter.containsContent(in: "Hello"))
        #expect(!CoreBlowMessageSegmenter.containsContent(in: ""))
        #expect(!CoreBlowMessageSegmenter.containsContent(in: "   "))
    }
}
