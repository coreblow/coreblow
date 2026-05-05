import AVFoundation; import Foundation
public final class TalkSystemSpeechSynthesizer: NSObject, AVSpeechSynthesizerDelegate, @unchecked Sendable {
    private let synth = AVSpeechSynthesizer(); private var continuation: CheckedContinuation<Void, Never>?
    public override init() { super.init(); synth.delegate = self }
    public func speak(_ text: String, voice: String? = nil, rate: Float = 0.5) async {
        let utterance = AVSpeechUtterance(string: text); utterance.rate = rate
        if let voice { utterance.voice = AVSpeechSynthesisVoice(identifier: voice) }
        await withCheckedContinuation { cont in continuation = cont; synth.speak(utterance) }
    }
    public func stop() { synth.stopSpeaking(at: .immediate); continuation?.resume(); continuation = nil }
    public func speechSynthesizer(_ s: AVSpeechSynthesizer, didFinish u: AVSpeechUtterance) { continuation?.resume(); continuation = nil }
}
