import AVFoundation; import Foundation
@MainActor final class MicLevelMonitor {
    private var engine: AVAudioEngine?; private(set) var currentLevel: Float = 0
    func start() { engine = AVAudioEngine(); /* monitor levels */ }
    func stop() { engine?.stop(); engine = nil; currentLevel = 0 }
}
