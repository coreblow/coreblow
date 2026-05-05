import Foundation
extension VoiceWakeOverlayController { func beginSession() { overlay.show(text: "Listening…") }; func endSession() { overlay.dismiss() } }
