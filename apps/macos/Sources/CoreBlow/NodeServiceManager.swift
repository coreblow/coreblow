import Foundation; import Observation
@MainActor @Observable final class NodeServiceManager {
    struct NodeInfo: Identifiable { let id: String; let name: String; let platform: String; let capabilities: [String] }
    var nodes: [NodeInfo] = []
    func refresh() async { /* fetch from gateway */ }
}
