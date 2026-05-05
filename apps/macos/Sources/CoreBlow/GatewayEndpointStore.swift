import Foundation
struct GatewayEndpointRecord: Codable, Identifiable, Equatable {
    var id: String { "\(host):\(port)" }
    let host: String; let port: UInt16; let name: String?; let useTLS: Bool; let lastConnected: Date?
}
@MainActor final class GatewayEndpointStore {
    private let key = "coreblow.endpoints"
    var endpoints: [GatewayEndpointRecord] {
        get { (try? JSONDecoder().decode([GatewayEndpointRecord].self, from: UserDefaults.standard.data(forKey: key) ?? Data())) ?? [] }
        set { UserDefaults.standard.set(try? JSONEncoder().encode(newValue), forKey: key) }
    }
    func addOrUpdate(_ record: GatewayEndpointRecord) {
        var list = endpoints; list.removeAll { $0.id == record.id }; list.insert(record, at: 0); endpoints = list
    }
    func remove(id: String) { endpoints.removeAll { $0.id == id } }
}
