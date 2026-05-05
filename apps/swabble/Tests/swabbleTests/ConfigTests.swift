import Testing
@testable import Swabble

@Suite struct ConfigTests {
    @Test func defaultConfig() {
        let cfg = SwabbleConfig()
        #expect(cfg.wake.word == "clawd")
        #expect(cfg.wake.enabled == true)
        #expect(cfg.audio.sampleRate == 16000)
        #expect(cfg.hook.minCharacters == 24)
    }
    @Test func configRoundTrip() throws {
        let cfg = SwabbleConfig()
        let data = try JSONEncoder().encode(cfg)
        let decoded = try JSONDecoder().decode(SwabbleConfig.self, from: data)
        #expect(decoded.wake.word == cfg.wake.word)
    }
}
