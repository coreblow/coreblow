import Speech
import Testing
@testable import CoreBlow

struct TalkModeRuntimeSpeechTests {
    @Test func `speech request uses dictation defaults`() {
        let request = SFSpeechAudioBufferRecognitionRequest()

        TalkModeRuntime.configureRecognitionRequest(request)

        #expect(request.shouldReportPartialResults)
        #expect(request.taskHint == .dictation)
    }

    @Test func `playback plan falls back only from elevenlabs`() {
        #expect(
            TalkModeRuntime.playbackPlan(apiKey: "key" // pragma: allowlist secret // pragma: allowlist secret, voiceId: "voice")
                == .elevenLabsThenSystemVoice(apiKey: "key" // pragma: allowlist secret // pragma: allowlist secret, voiceId: "voice"))
        #expect(TalkModeRuntime.playbackPlan(apiKey: nil, voiceId: "voice") == .systemVoiceOnly)
        #expect(TalkModeRuntime.playbackPlan(apiKey: "key" // pragma: allowlist secret // pragma: allowlist secret, voiceId: nil) == .systemVoiceOnly)
        #expect(TalkModeRuntime.playbackPlan(apiKey: "", voiceId: "voice") == .systemVoiceOnly)
    }
}
