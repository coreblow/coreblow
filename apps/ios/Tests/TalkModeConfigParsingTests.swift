import Foundation
import Testing
@testable import CoreBlow

@Suite("TalkModeConfigParsing")
struct TalkModeConfigParsingTests {
    @Test func defaultConfigHasReasonableValues() {
        let config = TalkModeGatewayConfig()
        #expect(config.sttLocale == "en-US")
        #expect(config.silenceTimeoutMs > 0)
    }

    @Test func sampleRateDefaultIsValid() {
        #expect(TalkDefaults.sampleRate > 0)
        #expect(TalkDefaults.sampleRate == 16000)
    }
}
