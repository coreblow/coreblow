import AVFoundation; import Foundation
actor TalkModeRuntime {
    private var audioEngine: AVAudioEngine?; private(set) var isRecording = false
    func startRecording(sampleRate: Double) throws { audioEngine = AVAudioEngine(); isRecording = true }
    func stopRecording() -> Data? { audioEngine?.stop(); audioEngine = nil; isRecording = false; return nil }
}
