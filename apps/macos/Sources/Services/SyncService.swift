import Foundation

class SyncService {
    static let shared = SyncService()
    private init() {}

    func start() async throws {}
    func stop() {}
}
