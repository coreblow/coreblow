import Foundation; import Observation
@MainActor @Observable final class ChannelsStore {
    struct Channel: Identifiable, Codable { let id: String; var name: String; var type: String; var enabled: Bool }
    var channels: [Channel] = []
    func load() async { /* fetch from gateway */ }
    func toggle(id: String) { if let idx = channels.firstIndex(where: { $0.id == id }) { channels[idx].enabled.toggle() } }
}
