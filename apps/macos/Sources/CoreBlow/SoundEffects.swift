import AppKit
enum SoundEffects { static func playConnect() { NSSound(named: "Glass")?.play() }; static func playDisconnect() { NSSound(named: "Basso")?.play() }; static func playNotification() { NSSound(named: "Ping")?.play() } }
