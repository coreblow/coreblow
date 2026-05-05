import AVFoundation; import Foundation
@MainActor final class TalkAudioPlayer {
    private var player: AVAudioPlayer?
    func play(data: Data) throws { player = try AVAudioPlayer(data: data); player?.play() }
    func stop() { player?.stop(); player = nil }
    var isPlaying: Bool { player?.isPlaying ?? false }
}
