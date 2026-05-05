import Foundation; import Observation
@MainActor @Observable final class InstancesStore {
    struct Instance: Identifiable { let id: String; let name: String; let host: String; let port: UInt16; let status: String }
    var instances: [Instance] = []
    func refresh() async { /* fetch from gateway */ }
}
